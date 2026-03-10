import type { AudioformConfig } from "../types";

export const JOB_APPLICATION_TEMPLATE: AudioformConfig = {
  id: "job-application",
  title: "Job Application Form",
  description:
    "A spoken application intake that captures candidate basics, role fit, experience, and follow-up materials in a structured format.",
  instructions:
    "Sound clear and professional. Keep questions focused on role fit, experience, and logistics. Do not over-explain the process.",
  realtime: {
    model: "gpt-realtime",
    voice: "marin",
  },
  output: {
    formats: ["json", "markdown"],
  },
  theme: {
    accent: "#0f8e79",
    surface: "#eef7f4",
    panel: "#ffffff",
  },
  fields: [
    {
      id: "candidateName",
      label: "Candidate name",
      type: "text",
      required: true,
      promptTitle: "Get the candidate name",
      promptDetail: "Start by asking for the candidate's full name.",
    },
    {
      id: "email",
      label: "Email",
      type: "text",
      required: true,
      promptTitle: "Capture the contact email",
      promptDetail: "Ask for the best email address to use for updates.",
    },
    {
      id: "targetRole",
      label: "Role applied for",
      type: "text",
      required: true,
      promptTitle: "Confirm the target role",
      promptDetail: "Ask what role they are applying for so the record is routed correctly.",
    },
    {
      id: "yearsExperience",
      label: "Years of experience",
      type: "single_select",
      required: true,
      promptTitle: "Measure experience quickly",
      promptDetail: "Capture the candidate's experience band before going deeper.",
      options: [
        { value: "0-1", label: "0-1 years" },
        { value: "2-4", label: "2-4 years" },
        { value: "5-7", label: "5-7 years" },
        { value: "8+", label: "8+ years" },
      ],
    },
    {
      id: "strongestSkill",
      label: "Strongest skill",
      type: "long_text",
      required: true,
      promptTitle: "Surface the strongest skill",
      promptDetail: "Ask what they are strongest at and capture the explanation in their own words.",
    },
    {
      id: "workAuthorization",
      label: "Work authorization",
      type: "single_select",
      required: true,
      promptTitle: "Confirm work authorization",
      promptDetail: "Ask whether they are authorized to work in the hiring region.",
      options: [
        { value: "authorized", label: "Authorized" },
        { value: "requires-sponsorship", label: "Requires sponsorship" },
      ],
    },
    {
      id: "availability",
      label: "Availability",
      type: "single_select",
      required: true,
      promptTitle: "Get the start timeline",
      promptDetail: "Ask when they could start if selected.",
      options: [
        { value: "immediately", label: "Immediately" },
        { value: "2-weeks", label: "2 weeks" },
        { value: "1-month", label: "1 month" },
        { value: "flexible", label: "Flexible" },
      ],
    },
    {
      id: "portfolioUrl",
      label: "Portfolio URL",
      type: "url",
      required: false,
      promptTitle: "Optional portfolio link",
      promptDetail: "Capture a portfolio or LinkedIn URL if they want to share one.",
    },
    {
      id: "resumeNote",
      label: "Resume note",
      type: "file_ref",
      required: false,
      promptTitle: "Optional resume note",
      promptDetail: "Capture a note if they mention a resume or file they want to send later.",
    },
  ],
};
