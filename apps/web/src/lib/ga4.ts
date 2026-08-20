const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
export const TALKFORM_GA_MEASUREMENT_ID = "G-H3363LXJ61";

/** Return a valid public GA4 measurement id and fail safely to Talkform's canonical stream. */
export function talkformGaMeasurementId(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized && MEASUREMENT_ID_PATTERN.test(normalized)
    ? normalized
    : TALKFORM_GA_MEASUREMENT_ID;
}
