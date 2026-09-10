import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, fetch as publicFetch } from "undici";
import { PlatformError } from "./types";

type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;
const invalid = () => new PlatformError("invalid_webhook_url", 400, "Webhook must use a public HTTPS URL on port 443 without credentials or fragments.");
function publicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch { return false; }
}

export function validateWebhookUrl(input: unknown) {
  if (typeof input !== "string" || input.length > 2048) throw invalid();
  let url: URL;
  try { url = new URL(input); } catch { throw invalid(); }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443") ||
    /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host) ||
    (!host.includes(".") && !ipaddr.isValid(host)) || (ipaddr.isValid(host) && !publicAddress(host))) throw invalid();
  return url.toString();
}

export async function resolveWebhookAddresses(input: string, resolver: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true }), timeoutMs = 5_000) {
  const url = new URL(validateWebhookUrl(input));
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let addresses: Address[];
  try {
    addresses = ipaddr.isValid(host)
      ? [{ address: host, family: ipaddr.parse(host).kind() === "ipv6" ? 6 : 4 }]
      : await Promise.race([
        resolver(host),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Webhook DNS resolution timed out.")), timeoutMs);
        }),
      ]);
  } finally { if (timer) clearTimeout(timer); }
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw invalid();
  return addresses;
}

export function webhookSignature(secret: string, body: string, timestamp: number) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex")}`;
}

export function webhookRetryDelay(attempt: number) {
  return [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 86_400_000][attempt - 1] ?? null;
}

export async function sendWebhook(url: string, rawBody: string, secret: string, eventId: string): Promise<number> {
  // Resolve on every attempt, then pin that exact address set for the connection.
  // A second DNS lookup or a redirect must never move a request onto a private network.
  const addresses = await resolveWebhookAddresses(url);
  const dispatcher = new Agent({ connect: { lookup(_hostname, options, callback) {
    if ((options as { all?: boolean }).all) callback(null, addresses);
    else callback(null, addresses[0]!.address, addresses[0]!.family);
  } } });
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await publicFetch(url, {
      method: "POST", redirect: "error", dispatcher, signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json", "user-agent": "Talkform-Webhooks/1.0", "x-talkform-event-id": eventId, "x-talkform-signature": webhookSignature(secret, rawBody, timestamp) },
      body: rawBody,
    });
    await response.body?.cancel();
    return response.status;
  } finally { await dispatcher.destroy(); }
}
