type BillingEnvironment = Record<string, string | undefined>;

const requiredKeys = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_ANNUAL", "DATABASE_URL", "TALKFORM_BILLING_READY",
] as const;

export function billingReadiness(env: BillingEnvironment) {
  const missing = requiredKeys.filter((key) => !env[key]?.trim() || (key === "TALKFORM_BILLING_READY" && env[key] !== "true"));
  return { ready: missing.length === 0, missing: [...missing] };
}

export function resolvePriceId(plan: unknown, interval: unknown, env: BillingEnvironment) {
  if (plan !== "pro") return null;
  if (interval === "month") return env.STRIPE_PRICE_PRO_MONTHLY?.trim() || null;
  if (interval === "year") return env.STRIPE_PRICE_PRO_ANNUAL?.trim() || null;
  return null;
}
