import { isFieldValueValid, normalizeFieldValue } from "./session";
import type { AudioformField, AudioformFieldValue } from "./types";

export type FieldReplyInterpretation =
  | { ok: true; value: AudioformFieldValue }
  | { ok: false; error: string };

const YES_REPLIES = new Set([
  "yes", "y", "yeah", "yea", "yep", "yup", "sure", "ok", "okay", "please", "true",
  "definitely", "absolutely", "of course", "i would", "i'd like to", "sounds good",
  "please do", "go ahead", "i think so", "i guess so", "let's do it", "lets do it",
]);

const NO_REPLIES = new Set([
  "no", "n", "nope", "nah", "no thanks", "no thank you", "not really", "never",
  "false", "skip", "pass", "i'd rather not", "i would not", "i don't think so",
  "i dont think so", "not now", "maybe later",
]);

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function normalizeReply(reply: string) {
  return reply.trim().toLowerCase().replace(/[!.?,]+$/g, "").replace(/\s+/g, " ");
}

function optionValues(field: AudioformField) {
  return (field.options ?? []).map((option) => option.value.toLowerCase());
}

function isYesNoField(field: AudioformField) {
  const values = optionValues(field);
  return field.type === "single_select" && values.length === 2 && values.includes("yes") && values.includes("no");
}

function optionByValue(field: AudioformField, value: string) {
  return field.options?.find((option) => option.value.toLowerCase() === value.toLowerCase());
}

function matchOptionExact(field: AudioformField, reply: string) {
  const normalized = normalizeReply(reply);
  return field.options?.find(
    (option) => option.value.toLowerCase() === normalized || option.label.toLowerCase() === normalized,
  );
}

function matchOptionMention(field: AudioformField, reply: string) {
  const normalized = normalizeReply(reply);
  const matches = (field.options ?? []).filter((option) => {
    const value = option.value.toLowerCase();
    const label = option.label.toLowerCase();
    return (
      normalized === value ||
      normalized === label ||
      normalized.includes(value) ||
      normalized.includes(label)
    );
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function missingChoiceError(field: AudioformField) {
  return `Choose one of: ${(field.options ?? []).map((entry) => entry.label).join(", ")}.`;
}

function applyValue(field: AudioformField, raw: unknown): FieldReplyInterpretation {
  const value = normalizeFieldValue(field, raw);
  if (value === undefined || !isFieldValueValid(field, value)) {
    if (field.type === "single_select" || field.type === "multi_select") {
      return { ok: false, error: missingChoiceError(field) };
    }
    if (field.type === "url") {
      return { ok: false, error: "Enter a complete URL beginning with http:// or https://." };
    }
    if (field.type === "number" || field.type === "rating") {
      return { ok: false, error: `Enter a number for ${field.label}.` };
    }
    return { ok: false, error: `${field.label} cannot be empty.` };
  }
  return { ok: true, value };
}

export function interpretFieldReply(field: AudioformField, reply: string): FieldReplyInterpretation {
  const trimmed = reply.trim();
  if (!trimmed) {
    return { ok: false, error: `${field.label} cannot be empty.` };
  }

  if (field.type === "text" || field.type === "long_text" || field.type === "file_ref") {
    return applyValue(field, trimmed);
  }

  if (field.type === "url") {
    return applyValue(field, trimmed);
  }

  if (field.type === "single_select") {
    const exact = matchOptionExact(field, trimmed);
    if (exact) return { ok: true, value: exact.value };
    if (isYesNoField(field)) {
      const normalized = normalizeReply(trimmed);
      if (YES_REPLIES.has(normalized)) return applyValue(field, optionByValue(field, "yes")?.value ?? "yes");
      if (NO_REPLIES.has(normalized)) return applyValue(field, optionByValue(field, "no")?.value ?? "no");
    }
    const mention = matchOptionMention(field, trimmed);
    if (mention) return { ok: true, value: mention.value };
    return { ok: false, error: missingChoiceError(field) };
  }

  if (field.type === "multi_select") {
    const parts = trimmed.split(/,|\band\b/i).map((entry) => entry.trim()).filter(Boolean);
    const options = parts.map((entry) => matchOptionExact(field, entry) ?? matchOptionMention(field, entry));
    if (!options.length || options.some((option) => !option)) {
      return { ok: false, error: `Choose one or more of: ${(field.options ?? []).map((entry) => entry.label).join(", ")}.` };
    }
    return { ok: true, value: Array.from(new Set(options.map((option) => option!.value))) };
  }

  if (field.type === "number" || field.type === "rating") {
    const word = NUMBER_WORDS[normalizeReply(trimmed)];
    if (typeof word === "number") return applyValue(field, word);
    const value = Number(trimmed);
    return applyValue(field, Number.isFinite(value) ? value : trimmed);
  }

  return { ok: false, error: `We could not capture ${field.label}.` };
}

export function buildFieldParseMessages(field: AudioformField, reply: string) {
  return {
    system:
      "Map one unstructured human reply onto a single Talkform field. Return JSON only: {\"value\": <typed value or null>, \"unclear\": true|false}. Use option values, not labels. Never invent an option that is not listed. If the reply does not decide the field, value is null and unclear is true.",
    user: JSON.stringify({
      field: {
        id: field.id,
        type: field.type,
        label: field.label,
        options: field.options ?? [],
        validation: field.validation ?? {},
      },
      reply,
    }),
  };
}

export function applyModelFieldValue(field: AudioformField, raw: unknown): FieldReplyInterpretation {
  if (raw === null || raw === undefined) {
    return interpretFieldReply(field, "");
  }
  return applyValue(field, raw);
}
