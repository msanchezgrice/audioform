import type { AudioformConfig } from "../types";

export const CUSTOMER_FEEDBACK_TEMPLATE: AudioformConfig = {
  id: "customer-feedback",
  title: "Customer Feedback Form",
  description:
    "Voice-first feedback collection for product teams that want structured answers without making customers type through a long form.",
  instructions:
    "Keep the tone warm and concise. Ask one question at a time, confirm what changed for the customer, and capture concrete wording when they describe pain points.",
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
      id: "customerName",
      label: "Customer name",
      type: "text",
      required: true,
      promptTitle: "Get the customer name",
      promptDetail: "Ask who is sharing the feedback so the team can follow up with the right person.",
    },
    {
      id: "companyName",
      label: "Company",
      type: "text",
      required: false,
      promptTitle: "Capture company context",
      promptDetail: "If they mention a company, capture it for segmentation and follow-up.",
    },
    {
      id: "productArea",
      label: "Product area",
      type: "single_select",
      required: true,
      promptTitle: "Pin down the product area",
      promptDetail: "Find the part of the product they are reacting to before asking for details.",
      options: [
        { value: "onboarding", label: "Onboarding" },
        { value: "dashboard", label: "Dashboard" },
        { value: "reporting", label: "Reporting" },
        { value: "billing", label: "Billing" },
        { value: "support", label: "Support" },
      ],
    },
    {
      id: "satisfaction",
      label: "Overall satisfaction",
      type: "rating",
      required: true,
      promptTitle: "Get a quick satisfaction score",
      promptDetail: "Ask for a simple 1 to 5 rating before moving into open feedback.",
      validation: {
        min: 1,
        max: 5,
      },
    },
    {
      id: "favoritePart",
      label: "Favorite part",
      type: "long_text",
      required: false,
      promptTitle: "Capture what is working",
      promptDetail: "Ask what they like most so the team can preserve the strongest parts of the product.",
    },
    {
      id: "biggestPainPoint",
      label: "Biggest pain point",
      type: "long_text",
      required: true,
      promptTitle: "Surface the biggest pain point",
      promptDetail: "Ask for the most frustrating part in their own words and capture the detail clearly.",
    },
    {
      id: "followUpRequested",
      label: "Wants follow-up",
      type: "single_select",
      required: true,
      promptTitle: "Confirm whether follow-up is needed",
      promptDetail: "Ask if they want someone from the team to reach back out.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      id: "followUpEmail",
      label: "Follow-up email",
      type: "text",
      required: false,
      promptTitle: "Capture follow-up contact details",
      promptDetail: "If they want follow-up, capture the best email address to use.",
    },
  ],
};
