import type { AudioformConfig } from "../types";

export const CUSTOMER_ONBOARDING_TEMPLATE: AudioformConfig = {
  id: "customer-onboarding",
  title: "Customer Onboarding Form",
  description:
    "A voice-first welcome flow that learns who new users are, what they want to accomplish, and how comfortable they are with AI-assisted workflows.",
  instructions:
    "Keep the tone warm and welcoming. Ask one question at a time and confirm what matters most to the user. When they describe goals, map their answers to the closest goal options rather than inventing new values.",
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
      id: "fullName",
      label: "Full name",
      type: "text",
      required: true,
      promptTitle: "Get the user name",
      promptDetail: "Ask who is onboarding so the experience can be personalized from the start.",
      visualTitle: "What should we call you?",
      visualDetail: "Say your name out loud and we'll fill it in for you.",
    },
    {
      id: "role",
      label: "Role",
      type: "text",
      required: true,
      promptTitle: "Capture the user role",
      promptDetail: "Ask what they do so the onboarding path can match their responsibilities.",
      visualTitle: "What do you do?",
      visualDetail: "Say your role or title out loud.",
    },
    {
      id: "goals",
      label: "Onboarding goals",
      type: "multi_select",
      required: true,
      promptTitle: "Understand what they want to achieve",
      promptDetail: "Ask which outcomes matter most so the product tour can be tailored to their priorities.",
      visualTitle: "What are you hoping to get out of this?",
      visualDetail: "Say every goal that applies.",
      options: [
        { value: "higher_completion", label: "Higher completion" },
        { value: "faster_intake", label: "Faster intake" },
        { value: "structured_data", label: "Structured data" },
        { value: "accessibility", label: "Accessibility" },
        { value: "research_at_scale", label: "Research at scale" },
      ],
    },
    {
      id: "teamContext",
      label: "Team context",
      type: "long_text",
      required: false,
      promptTitle: "Learn the team context",
      promptDetail: "Ask about the team or company setting so the onboarding can reference relevant workflows.",
      visualTitle: "Tell us a bit about your team or company.",
      visualDetail: "Answer in your own words — a sentence or two is perfect.",
    },
    {
      id: "aiComfort",
      label: "AI comfort level",
      type: "rating",
      required: true,
      promptTitle: "Gauge AI comfort",
      promptDetail: "Ask how comfortable they are with AI-driven tools on a 1 to 5 scale.",
      visualTitle: "How comfortable are you with AI-powered tools?",
      visualDetail: "Say a number from 1 to 5.",
      validation: {
        min: 1,
        max: 5,
      },
    },
  ],
};
