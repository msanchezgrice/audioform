import { AI_SKILL_TUTOR_TEMPLATE } from "./ai-skill-tutor";
import { CUSTOMER_FEEDBACK_TEMPLATE } from "./customer-feedback";
import { JOB_APPLICATION_TEMPLATE } from "./job-application";
import { LEAD_GENERATION_TEMPLATE } from "./lead-generation";

export {
  AI_SKILL_TUTOR_TEMPLATE,
  CUSTOMER_FEEDBACK_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
};

export const AUDIOFORM_TEMPLATES = [
  CUSTOMER_FEEDBACK_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  AI_SKILL_TUTOR_TEMPLATE,
];

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
