import { applyModelFieldValue, buildFieldParseMessages, interpretFieldReply, type AudioformField, type FieldReplyInterpretation } from "@talkform/core";
import { markReservationExposureUnknown, reserveCost, settleImportReservation, type CostIdentity } from "../cost/database";
import { estimateImportMicrousd } from "../cost/policy";

export async function parseRespondentFieldReply(input: {
  field: AudioformField;
  reply: string;
  costIdentity?: CostIdentity;
}): Promise<FieldReplyInterpretation> {
  const local = interpretFieldReply(input.field, input.reply);
  if (local.ok) return local;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !input.costIdentity) return local;

  let reservationId: string | null = null;
  try {
    const budget = await reserveCost("import_refinement", input.costIdentity);
    if (!budget.ok) return local;
    reservationId = budget.reservation.id;
    const messages = buildFieldParseMessages(input.field, input.reply);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: budget.policy.importModel,
        max_completion_tokens: Math.min(budget.policy.importMaxOutputTokens, 200),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      await markReservationExposureUnknown(reservationId);
      return local;
    }
    const payload = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    const inputTokens = Number.isSafeInteger(payload.usage?.prompt_tokens) ? payload.usage!.prompt_tokens! : -1;
    const outputTokens = Number.isSafeInteger(payload.usage?.completion_tokens) ? payload.usage!.completion_tokens! : -1;
    if (!content || inputTokens < 0 || outputTokens < 0) {
      await markReservationExposureUnknown(reservationId);
      return local;
    }
    await settleImportReservation(reservationId, inputTokens, outputTokens, estimateImportMicrousd(inputTokens, outputTokens));
    const parsed = JSON.parse(content) as { value?: unknown; unclear?: unknown };
    if (parsed.unclear === true || parsed.value === null || parsed.value === undefined) return local;
    return applyModelFieldValue(input.field, parsed.value);
  } catch {
    if (reservationId) await markReservationExposureUnknown(reservationId).catch(() => undefined);
    return local;
  }
}
