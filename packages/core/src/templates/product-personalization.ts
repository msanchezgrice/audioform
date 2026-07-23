import type { AudioformConfig } from "../types";

export const PRODUCT_PERSONALIZATION_TEMPLATE: AudioformConfig = {
  id: "product-personalization",
  title: "Product Personalization Form",
  description:
    "A conversational quiz that tunes the product experience to each user by capturing their goals, experience level, interests, and success criteria.",
  instructions:
    "Keep the tone curious and helpful. Ask one question at a time, and map free-form answers to the closest structured options before moving on.",
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
      id: "primaryGoal",
      label: "Primary goal",
      type: "single_select",
      required: true,
      promptTitle: "Identify the primary goal",
      promptDetail: "Ask what they are mainly trying to accomplish so the experience can be prioritized.",
      visualTitle: "What is your primary goal?",
      visualDetail: "Say the outcome that matters most to you.",
      options: [
        { value: "higher_completion", label: "Higher completion" },
        { value: "faster_intake", label: "Faster intake" },
        { value: "structured_data", label: "Structured data" },
        { value: "accessibility", label: "Accessibility" },
      ],
    },
    {
      id: "experienceLevel",
      label: "Experience level",
      type: "single_select",
      required: true,
      promptTitle: "Gauge experience level",
      promptDetail: "Ask how familiar they are with this type of product so the UI can adapt.",
      visualTitle: "How experienced are you with tools like this?",
      visualDetail: "Say the level that fits best.",
      options: [
        { value: "first_time", label: "First time" },
        { value: "some_experience", label: "Some experience" },
        { value: "power_user", label: "Power user" },
      ],
    },
    {
      id: "interests",
      label: "Interest areas",
      type: "multi_select",
      required: true,
      promptTitle: "Capture interest areas",
      promptDetail: "Ask which topics or features they care about so the product can surface relevant content.",
      visualTitle: "Which areas interest you most?",
      visualDetail: "Say every area that applies.",
      options: [
        { value: "voice_forms", label: "Voice forms" },
        { value: "integrations", label: "Integrations" },
        { value: "analytics", label: "Analytics" },
        { value: "automation", label: "Automation" },
        { value: "embeddings", label: "Embeddings" },
      ],
    },
    {
      id: "successCriteria",
      label: "Success criteria",
      type: "long_text",
      required: false,
      promptTitle: "Define what success looks like",
      promptDetail: "Ask how they will measure whether the product is working for them.",
      visualTitle: "What would success look like for you?",
      visualDetail: "Answer in your own words.",
    },
  ],
};
