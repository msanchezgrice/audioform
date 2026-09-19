import type { AudioformBranding, AudioformConfig, AudioformField, AudioformInterviewMode, AudioformTheme } from "./types";

export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export const SAFE_FONT_FAMILY_PATTERN =
  /^[A-Za-z][A-Za-z0-9 \-']*(?:,\s*(?:[A-Za-z][A-Za-z0-9 \-']*|serif|sans-serif|monospace|system-ui))*$/;

export const NEUTRAL_INTERVIEW_THEME: Required<AudioformTheme> = {
  accent: "#1c1917",
  surface: "#f3efe8",
  panel: "#ffffff",
};

export function isHexColor(value: string | undefined): value is string {
  return Boolean(value && HEX_COLOR_PATTERN.test(value));
}

export function sanitizeThemeColor(value: string | undefined): string | undefined {
  return isHexColor(value) ? value : undefined;
}

const WHITE = "#ffffff";
const INK = "#1c1917";
const MIN_UI_CONTRAST = 3;

function expandHexChannel(value: string) {
  return value.length === 1 ? value + value : value;
}

function hexToRgb(value: string): { r: number; g: number; b: number } | undefined {
  if (!isHexColor(value)) return undefined;
  const hex = value.slice(1);
  const raw = hex.length === 3 || hex.length === 4
    ? [hex[0], hex[1], hex[2]]
    : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
  const [r, g, b] = raw.map((channel) => Number.parseInt(expandHexChannel(channel), 16));
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return undefined;
  return { r, g, b };
}

function relativeLuminance(value: string) {
  const rgb = hexToRgb(value);
  if (!rgb) return undefined;
  const channel = (part: number) => {
    const scaled = part / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(foreground: string, background: string) {
  const left = relativeLuminance(foreground);
  const right = relativeLuminance(background);
  if (left === undefined || right === undefined) return 0;
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function readableThemeColor(value: string | undefined, against: string, fallback: string) {
  const sanitized = sanitizeThemeColor(value);
  if (!sanitized) return fallback;
  return contrastRatio(sanitized, against) >= MIN_UI_CONTRAST ? sanitized : fallback;
}

export function isHttpsUrl(value: string | undefined, maxLength = 2_048): value is string {
  if (!value || value.length > maxLength) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function sanitizeFontFamily(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 80 || !SAFE_FONT_FAMILY_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

export function getRespondentQuestion(field: AudioformField) {
  const visual = field.visualTitle?.trim();
  const prompt = field.promptTitle.trim();
  if (visual && visual !== field.label.trim()) return visual;
  return prompt || field.label;
}

export function getRespondentQuestionDetail(field: AudioformField) {
  const visual = field.visualDetail?.trim();
  const prompt = field.promptDetail.trim();
  if (visual && visual !== prompt) return visual;
  return "";
}

export function resolveInterviewTheme(theme: AudioformTheme | undefined, fallback: Required<AudioformTheme> = NEUTRAL_INTERVIEW_THEME): Required<AudioformTheme> {
  return {
    accent: readableThemeColor(theme?.accent, WHITE, fallback.accent),
    surface: readableThemeColor(theme?.surface, INK, fallback.surface),
    panel: readableThemeColor(theme?.panel, INK, fallback.panel),
  };
}

export function resolveInterviewBranding(branding: AudioformBranding | undefined) {
  return {
    fromName: branding?.fromName?.trim() || undefined,
    purpose: branding?.purpose?.trim() || undefined,
    logoUrl: isHttpsUrl(branding?.logoUrl) ? branding!.logoUrl : undefined,
    wordmark: branding?.wordmark?.trim() || undefined,
    faviconUrl: isHttpsUrl(branding?.faviconUrl) ? branding!.faviconUrl : undefined,
    fontFamily: sanitizeFontFamily(branding?.fontFamily),
    showPoweredBy: branding?.showPoweredBy === true,
  };
}

export function resolveEffectiveInterviewMode(input: {
  requested?: AudioformInterviewMode;
  voiceEligible: boolean;
}): AudioformInterviewMode {
  if (input.requested === "text" || !input.voiceEligible) return "text";
  return "voice";
}

export function buildHandoffShareCopy(input: {
  config: Pick<AudioformConfig, "title" | "description" | "branding">;
  respondentUrl: string;
  mode: AudioformInterviewMode;
}) {
  const branding = resolveInterviewBranding(input.config.branding);
  const title = input.config.title.trim();
  const purpose = branding.purpose || input.config.description?.trim() || undefined;
  const fromName = branding.fromName;
  const kind = input.mode === "voice" ? "voice interview" : "short interview";
  const blurb = purpose || title;
  const shareText = fromName
    ? `${fromName} asked for a ${kind}: ${blurb}\n${input.respondentUrl}`
    : `Please complete this ${kind}: ${blurb}\n${input.respondentUrl}`;

  return {
    title,
    purpose: purpose ?? null,
    fromName: fromName ?? null,
    shareText,
  };
}
