type PilotRequestValue = {
  email: string;
  useCase: string;
  formUrl?: string;
};

type PilotRequestResult =
  | { ok: true; value: PilotRequestValue }
  | { ok: false; error: string };

const PERSONAL_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
]);

function safeSourceUrl(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 2_048) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === "::1"
    ) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function parsePilotRequest(input: unknown): PilotRequestResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Enter a business email and use case." };
  }
  const record = input as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const useCase = typeof record.useCase === "string" ? record.useCase.trim() : "";
  const domain = email.split("@")[1] ?? "";
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    PERSONAL_EMAIL_DOMAINS.has(domain)
  ) {
    return { ok: false, error: "Enter a business email address." };
  }
  if (useCase.length < 20 || useCase.length > 1_000) {
    return { ok: false, error: "Describe the business workflow in 20 to 1,000 characters." };
  }
  const formUrl = safeSourceUrl(record.formUrl);
  if (formUrl === null) {
    return { ok: false, error: "The optional form URL must be a public HTTPS URL." };
  }
  return {
    ok: true,
    value: {
      email,
      useCase,
      ...(formUrl ? { formUrl } : {}),
    },
  };
}

export function pilotCheckoutSessionParams(input: {
  requestId: string;
  email: string;
  priceId: string;
  origin: string;
}) {
  const origin = new URL(input.origin).origin;
  return {
    mode: "payment" as const,
    line_items: [{ price: input.priceId, quantity: 1 }],
    customer_email: input.email,
    client_reference_id: input.requestId,
    success_url: `${origin}/pilot/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pilot?checkout=cancelled`,
    metadata: {
      talkform_offer: "guided_pilot",
      pilot_request_id: input.requestId,
    },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pilotPaymentFromCheckout(
  sessionValue: unknown,
  lineItemValues: unknown,
  expectedPriceId: string,
) {
  if (!sessionValue || typeof sessionValue !== "object" || Array.isArray(sessionValue)) return null;
  if (!Array.isArray(lineItemValues) || lineItemValues.length !== 1) return null;
  const session = sessionValue as Record<string, unknown>;
  const metadata = session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata)
    ? session.metadata as Record<string, unknown>
    : {};
  const requestId = metadata.pilot_request_id;
  const line = lineItemValues[0] as Record<string, unknown> | null;
  const price = line?.price && typeof line.price === "object" && !Array.isArray(line.price)
    ? line.price as Record<string, unknown>
    : null;
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent && typeof session.payment_intent === "object" && !Array.isArray(session.payment_intent)
      ? (session.payment_intent as Record<string, unknown>).id
      : null;

  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    metadata.talkform_offer !== "guided_pilot" ||
    typeof requestId !== "string" ||
    !UUID_PATTERN.test(requestId) ||
    session.client_reference_id !== requestId ||
    typeof session.id !== "string" ||
    typeof paymentIntent !== "string" ||
    price?.id !== expectedPriceId ||
    line?.quantity !== 1
  ) return null;

  return {
    requestId,
    checkoutSessionId: session.id,
    paymentIntentId: paymentIntent,
  };
}

export async function persistPilotPaymentThenCapture(input: {
  persist: () => Promise<{ duplicate: boolean }>;
  capture: () => Promise<unknown>;
}) {
  const result = await input.persist();
  if (!result.duplicate) await input.capture();
  return result;
}
