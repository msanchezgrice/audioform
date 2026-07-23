import type { AudioformConfig } from "../types";

export const USER_RESEARCH_TEMPLATE: AudioformConfig = {
  id: "user-research",
  title: "User Research Form",
  description:
    "An open-ended voice interview for capturing participant context, pain points, and verbatim quotes during moderated or unmoderated research sessions.",
  instructions:
    "Keep the tone neutral and curious. Let the participant tell their story without leading them. Capture verbatim quotes exactly as spoken.",
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
      id: "participantName",
      label: "Participant name",
      type: "text",
      required: true,
      promptTitle: "Get the participant name",
      promptDetail: "Ask who is participating so the session can be attributed correctly.",
      visualTitle: "What is your name?",
      visualDetail: "Say your name out loud.",
    },
    {
      id: "context",
      label: "Session context",
      type: "long_text",
      required: true,
      promptTitle: "Set the scene",
      promptDetail: "Ask the participant to describe the situation or task they were doing when the experience happened.",
      visualTitle: "Walk me through what you were doing.",
      visualDetail: "Set the scene in your own words.",
    },
    {
      id: "painPoints",
      label: "Pain points",
      type: "long_text",
      required: true,
      promptTitle: "Surface pain points",
      promptDetail: "Ask what frustrated or blocked them and capture the details in their own words.",
      visualTitle: "What was the most frustrating part?",
      visualDetail: "Tell us in your own words.",
    },
    {
      id: "memorableQuote",
      label: "Memorable quote",
      type: "long_text",
      required: false,
      promptTitle: "Capture a verbatim quote",
      promptDetail: "If the participant says something striking, capture it word-for-word for the research report.",
      visualTitle: "Is there anything you would say to the team directly?",
      visualDetail: "Speak freely — we'll capture it verbatim.",
    },
    {
      id: "followUpConsent",
      label: "Follow-up consent",
      type: "single_select",
      required: true,
      promptTitle: "Confirm follow-up consent",
      promptDetail: "Ask whether the research team can reach out for a follow-up session.",
      visualTitle: "Can we follow up with you later?",
      visualDetail: "Just say yes or no.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
};
