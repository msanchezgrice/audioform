import type { AudioformConfig } from "../types";

export const NPS_SURVEY_TEMPLATE: AudioformConfig = {
  id: "nps-survey",
  title: "NPS Survey Form",
  description:
    "A quick voice-first Net Promoter Score survey that captures the score, the reasoning behind it, and one actionable improvement suggestion.",
  instructions:
    "Keep the tone light and efficient. Get the score first, then ask one follow-up at a time. Capture the reason in the respondent's own words.",
  realtime: {
    model: "gpt-realtime-2.1",
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
      id: "npsScore",
      label: "NPS score",
      type: "rating",
      required: true,
      promptTitle: "Get the NPS score",
      promptDetail: "Ask how likely they are to recommend the product on a 0 to 10 scale.",
      visualTitle: "How likely are you to recommend us to a friend or colleague?",
      visualDetail: "Say a number from 0 to 10.",
      validation: {
        min: 0,
        max: 10,
      },
    },
    {
      id: "npsReason",
      label: "Reason for score",
      type: "long_text",
      required: true,
      promptTitle: "Capture the why behind the score",
      promptDetail: "Ask what drove their rating so the team understands the context behind the number.",
      visualTitle: "What is the main reason for your score?",
      visualDetail: "Tell us in your own words.",
    },
    {
      id: "improveOne",
      label: "One thing to improve",
      type: "long_text",
      required: false,
      promptTitle: "Surface one improvement",
      promptDetail: "Ask for the single most important thing the team could change or improve.",
      visualTitle: "What is one thing we could improve?",
      visualDetail: "Answer in your own words, or skip this one.",
    },
  ],
};
