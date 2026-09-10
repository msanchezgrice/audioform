import type { OperatorNotificationSender } from "./index";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;

export type OperatorEmailDeliveryStatus =
  | { configured: true; provider: "resend" }
  | {
      configured: false;
      provider: "resend";
      reason: "resend_api_key_missing" | "operator_email_from_missing" | "operator_email_from_invalid";
    };

type Fetcher = typeof fetch;

function validSender(value: string) {
  if (!value || value.length > 320 || /[\r\n]/.test(value)) return false;
  const match = value.match(/^(?:[^<>]*<)?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?$/);
  return Boolean(match);
}

function deliveryError(code: string) {
  const error = new Error("Operator email delivery failed.");
  error.name = code;
  return error;
}

export function getOperatorEmailDeliveryStatus(
  env: Record<string, string | undefined> = process.env,
): OperatorEmailDeliveryStatus {
  if (!env.RESEND_API_KEY?.trim()) {
    return { configured: false, provider: "resend", reason: "resend_api_key_missing" };
  }
  const from = env.TALKFORM_OPERATOR_EMAIL_FROM?.trim() ?? "";
  if (!from) {
    return { configured: false, provider: "resend", reason: "operator_email_from_missing" };
  }
  if (!validSender(from)) {
    return { configured: false, provider: "resend", reason: "operator_email_from_invalid" };
  }
  return { configured: true, provider: "resend" };
}

export function createResendOperatorNotificationSender(
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch,
): OperatorNotificationSender | null {
  if (!getOperatorEmailDeliveryStatus(env).configured) return null;
  const apiKey = env.RESEND_API_KEY!.trim();
  const from = env.TALKFORM_OPERATOR_EMAIL_FROM!.trim();

  return async ({ to, idempotencyKey, message }) => {
    if (!idempotencyKey || idempotencyKey.length > 256 || /[^\x20-\x7e]/.test(idempotencyKey)) {
      throw deliveryError("resend_invalid_idempotency_key");
    }
    let response: Response;
    try {
      response = await fetcher(RESEND_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ from, to: [to], subject: message.subject, text: message.text }),
        redirect: "error",
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw deliveryError("resend_timeout");
      }
      throw deliveryError("resend_transport_error");
    }
    if (!response.ok) throw deliveryError(`resend_http_${response.status}`);

    let payload: unknown;
    try {
      const raw = await response.text();
      if (raw.length > 4_096) throw deliveryError("resend_invalid_response");
      payload = JSON.parse(raw);
    } catch (error) {
      if (error instanceof Error && error.name === "resend_invalid_response") throw error;
      throw deliveryError("resend_invalid_response");
    }
    const id = payload && typeof payload === "object" && "id" in payload
      ? (payload as { id?: unknown }).id
      : null;
    if (typeof id !== "string" || !id.trim() || id.length > 240) {
      throw deliveryError("resend_invalid_response");
    }
    return { providerMessageId: id };
  };
}
