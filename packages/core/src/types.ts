export type AudioformFieldType =
  | "text"
  | "long_text"
  | "single_select"
  | "multi_select"
  | "number"
  | "rating"
  | "url"
  | "file_ref";

export type AudioformFieldOption = {
  value: string;
  label: string;
};

export type AudioformFieldValidation = {
  min?: number;
  max?: number;
  pattern?: string;
};

export type AudioformField = {
  id: string;
  label: string;
  type: AudioformFieldType;
  required: boolean;
  promptTitle: string;
  promptDetail: string;
  options?: AudioformFieldOption[];
  validation?: AudioformFieldValidation;
  agentHint?: string;
  placeholder?: string;
};

export type AudioformTheme = {
  accent?: string;
  surface?: string;
  panel?: string;
};

export type AudioformConfig = {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  fields: AudioformField[];
  theme?: AudioformTheme;
  realtime?: {
    model?: string;
    voice?: string;
  };
  output?: {
    formats?: Array<"json" | "markdown">;
    webhookUrl?: string;
  };
};

export type AudioformFieldValue = string | number | string[] | null;
export type AudioformFieldMap = Record<string, AudioformFieldValue>;

export type TranscriptSpeaker = "assistant" | "user" | "system";

export type TranscriptEntry = {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  timestamp: number;
};

export type AudioformSessionStatus = "in_progress" | "completed" | "abandoned";

export type AudioformSession = {
  sessionId: string;
  formId: string;
  status: AudioformSessionStatus;
  values: AudioformFieldMap;
  summary: string;
  transcript: TranscriptEntry[];
  currentPromptFieldId: string | null;
  createdAt: string;
  updatedAt: string;
  model: string;
  voice: string;
};

export type AudioformCompletion = {
  required: number;
  captured: number;
  percent: number;
  missingFieldIds: string[];
};

export type AudioformSessionResult = {
  schemaVersion: "1.0";
  formId: string;
  sessionId: string;
  status: AudioformSessionStatus;
  completion: AudioformCompletion;
  currentPrompt: { fieldId: string; title: string; detail: string } | null;
  fields: AudioformFieldMap;
  transcript: TranscriptEntry[];
  summary: string;
  metadata: {
    model: string;
    voice: string;
    startedAt: string;
    completedAt?: string;
  };
};

export type AudioformRealtimeUpdate = {
  summary?: string;
  values: AudioformFieldMap;
  needsFollowup: string[];
};

