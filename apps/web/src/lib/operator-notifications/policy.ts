export const REGISTRATION_DIGEST_MINUTES = 15;
export const NOTIFICATION_MAX_ATTEMPTS = 6;

export type BudgetLevel = "nearing" | "exhausted" | null;

export function budgetLevel(exposureMicrousd: number, limitMicrousd: number): BudgetLevel {
  if (!Number.isSafeInteger(exposureMicrousd) || exposureMicrousd < 0) return null;
  if (!Number.isSafeInteger(limitMicrousd) || limitMicrousd <= 0) return null;
  if (exposureMicrousd >= limitMicrousd) return "exhausted";
  return exposureMicrousd * 5 >= limitMicrousd * 4 ? "nearing" : null;
}

export function registrationDigestWindow(now: Date) {
  const size = REGISTRATION_DIGEST_MINUTES * 60_000;
  const startMs = Math.floor(now.getTime() / size) * size;
  return {
    start: new Date(startMs),
    end: new Date(startMs + size),
  };
}

export function retryDelaySeconds(attemptCount: number) {
  const schedule = [60, 5 * 60, 15 * 60, 60 * 60, 4 * 60 * 60];
  return schedule[Math.min(Math.max(attemptCount - 1, 0), schedule.length - 1)];
}

export function boundedFailureCode(error: unknown) {
  const candidate = error && typeof error === "object" && "name" in error && typeof error.name === "string"
    ? error.name
    : "delivery_error";
  const normalized = candidate.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 80);
  return normalized || "delivery_error";
}

export function operatorRecipient(env: Record<string, string | undefined> = process.env) {
  const configured = env.TALKFORM_OPERATOR_EMAIL?.trim().toLowerCase();
  const allowlisted = (env.TALKFORM_OPERATOR_EMAILS ?? "").split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const email = configured || (allowlisted.length === 1 ? allowlisted[0] : "");
  if (!email) throw new Error("Operator notification recipient is not configured.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Operator notification recipient is invalid.");
  }
  return email;
}

export function utcDayKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

export function utcMonthKey(now: Date) {
  return now.toISOString().slice(0, 7);
}
