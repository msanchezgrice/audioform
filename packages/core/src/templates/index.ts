import { AI_SKILL_TUTOR_TEMPLATE } from "./ai-skill-tutor";

export const AUDIOFORM_TEMPLATES = [AI_SKILL_TUTOR_TEMPLATE];

export function listAudioformTemplates() {
  return AUDIOFORM_TEMPLATES.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description ?? "",
  }));
}

export function getAudioformTemplate(id: string) {
  return AUDIOFORM_TEMPLATES.find((template) => template.id === id) ?? null;
}

