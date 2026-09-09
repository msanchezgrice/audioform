import type { AudioformConfig, AudioformFieldMap, AudioformSessionResult } from "@talkform/core";

export const PLATFORM_LIMITS = {
  projectsPerAccount: 5, activeKeysPerProject: 5, handoffsPerProjectPerDay: 100,
  configBytes: 64 * 1024, configFields: 50, inviteDays: 7, resultDays: 7,
} as const;
export type ProjectEnvironment = "production" | "test";
export type RespondentMode = "voice" | "text";
export type HostedHandoffStatus = "pending" | "completed" | "expired" | "deleted";
export type ApiKeyScope = "handoffs:read" | "handoffs:write" | "handoffs:delete";
export type PlatformProject = { id: string; name: string; environment: ProjectEnvironment; dailyHandoffLimit: number; createdAt: string; updatedAt: string };
export type PlatformApiKey = { id: string; projectId: string; name: string; prefix: string; scopes: ApiKeyScope[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
export type CreatedPlatformApiKey = PlatformApiKey & { secret: string };
export type AuthenticatedProjectKey = { keyId: string; projectId: string; environment: ProjectEnvironment; scopes: ApiKeyScope[] };
export type PlatformHandoff = { id: string; projectId: string; status: HostedHandoffStatus; createdAt: string; expiresAt: string; completedAt: string | null; resultExpiresAt: string | null };
export type CreatedPlatformHandoff = PlatformHandoff & { respondentUrl: string };
export type RespondentHandoff = { id: string; config: AudioformConfig; status: HostedHandoffStatus; expiresAt: string };
export type RespondentSubmission = { values: AudioformFieldMap; mode: RespondentMode };
export type HostedAudioformSessionResult = Omit<AudioformSessionResult, "metadata"> & { metadata: AudioformSessionResult["metadata"] & { mode: RespondentMode } };
export type ProjectDashboard = { project: PlatformProject; counts: Record<HostedHandoffStatus, number>; handoffsCreatedToday: number; keys: PlatformApiKey[]; recentHandoffs: PlatformHandoff[] };
export type PlatformEventName = "handoff.created" | "handoff.completed" | "handoff.result_retrieved" | "handoff.deleted";
export type PlatformEvent = { id: string; eventKey: string; eventName: PlatformEventName; projectId: string; keyId: string | null; handoffId: string | null; environment: ProjectEnvironment; createdAt: string };
export class PlatformError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) { super(message); this.name = "PlatformError"; }
}
