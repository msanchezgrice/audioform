import { z } from "zod";
import { audioformConfigSchema } from "./schema";

const reviewedValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.string()).max(100),
]);

export const handoffCreateRequestSchema = z.object({
  config: audioformConfigSchema,
}).strict();

export const handoffCreatedSchema = z.object({
  handoffId: z.string().min(1),
  userUrl: z.string().url(),
  status: z.literal("pending"),
  expiresAt: z.string().datetime(),
}).strict();

export const handoffStatusSchema = z.object({
  handoffId: z.string().min(1),
  status: z.enum(["pending", "claimed", "completed", "expired", "deleted"]),
  expiresAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
}).strict();

export const reviewedHandoffResultSchema = z.object({
  handoffId: z.string().min(1),
  formId: z.string().min(1),
  fields: z.record(reviewedValueSchema),
  completedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();

export type HandoffCreateRequest = z.infer<typeof handoffCreateRequestSchema>;
export type HandoffCreated = z.infer<typeof handoffCreatedSchema>;
export type HandoffStatus = z.infer<typeof handoffStatusSchema>;
export type ReviewedHandoffResult = z.infer<typeof reviewedHandoffResultSchema>;
