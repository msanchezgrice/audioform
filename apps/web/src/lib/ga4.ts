const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

/** Return only a valid public GA4 measurement id; never accept arbitrary script input. */
export function talkformGaMeasurementId(value: string | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase();
  return normalized && MEASUREMENT_ID_PATTERN.test(normalized) ? normalized : undefined;
}

