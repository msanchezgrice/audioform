import { AI_SKILL_TUTOR_TEMPLATE } from "./ai-skill-tutor";
import { CUSTOMER_FEEDBACK_TEMPLATE } from "./customer-feedback";
import { CUSTOMER_ONBOARDING_TEMPLATE } from "./customer-onboarding";
import { JOB_APPLICATION_TEMPLATE } from "./job-application";
import { LEAD_GENERATION_TEMPLATE } from "./lead-generation";
import { NPS_SURVEY_TEMPLATE } from "./nps-survey";
import { PRODUCT_PERSONALIZATION_TEMPLATE } from "./product-personalization";
import { USER_RESEARCH_TEMPLATE } from "./user-research";

export {
  AI_SKILL_TUTOR_TEMPLATE,
  CUSTOMER_FEEDBACK_TEMPLATE,
  CUSTOMER_ONBOARDING_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
  NPS_SURVEY_TEMPLATE,
  PRODUCT_PERSONALIZATION_TEMPLATE,
  USER_RESEARCH_TEMPLATE,
};

export const AUDIOFORM_TEMPLATES = [
  CUSTOMER_FEEDBACK_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  AI_SKILL_TUTOR_TEMPLATE,
  CUSTOMER_ONBOARDING_TEMPLATE,
  PRODUCT_PERSONALIZATION_TEMPLATE,
  NPS_SURVEY_TEMPLATE,
  USER_RESEARCH_TEMPLATE,
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
