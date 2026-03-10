import type { AudioformConfig } from "../types";

export const LEAD_GENERATION_TEMPLATE: AudioformConfig = {
  id: "lead-generation",
  title: "Lead Generation Form",
  description:
    "A conversational lead capture flow for qualifying inbound interest, purchase timeline, and the best next sales step.",
  instructions:
    "Keep the pace direct and commercial. Confirm company context, desired outcome, and urgency without sounding robotic.",
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
      id: "fullName",
      label: "Full name",
      type: "text",
      required: true,
      promptTitle: "Get the lead name",
      promptDetail: "Ask for the person's full name so the sales team can identify the lead cleanly.",
    },
    {
      id: "workEmail",
      label: "Work email",
      type: "text",
      required: true,
      promptTitle: "Capture the best email",
      promptDetail: "Ask for the email they want the team to use for follow-up.",
    },
    {
      id: "companyName",
      label: "Company name",
      type: "text",
      required: true,
      promptTitle: "Capture the company",
      promptDetail: "Get the company name before discussing the use case or timeline.",
    },
    {
      id: "teamSize",
      label: "Team size",
      type: "single_select",
      required: true,
      promptTitle: "Size the buying team",
      promptDetail: "Ask how large the team or company is so the lead can be qualified properly.",
      options: [
        { value: "1-10", label: "1-10" },
        { value: "11-50", label: "11-50" },
        { value: "51-200", label: "51-200" },
        { value: "201-1000", label: "201-1000" },
        { value: "1000+", label: "1000+" },
      ],
    },
    {
      id: "useCase",
      label: "Primary use case",
      type: "long_text",
      required: true,
      promptTitle: "Understand why they are interested",
      promptDetail: "Ask what they want the product to help them do right away.",
    },
    {
      id: "timeline",
      label: "Purchase timeline",
      type: "single_select",
      required: true,
      promptTitle: "Get the timeline",
      promptDetail: "Find out whether they need a solution this week, this quarter, or later on.",
      options: [
        { value: "this-week", label: "This week" },
        { value: "this-month", label: "This month" },
        { value: "this-quarter", label: "This quarter" },
        { value: "researching", label: "Just researching" },
      ],
    },
    {
      id: "budgetBand",
      label: "Budget band",
      type: "single_select",
      required: false,
      promptTitle: "Check the rough budget",
      promptDetail: "Budget is optional, but useful if the lead volunteers it.",
      options: [
        { value: "under-5k", label: "Under $5k" },
        { value: "5k-20k", label: "$5k-$20k" },
        { value: "20k-50k", label: "$20k-$50k" },
        { value: "50k+", label: "$50k+" },
      ],
    },
    {
      id: "nextStep",
      label: "Preferred next step",
      type: "single_select",
      required: true,
      promptTitle: "Lock the next sales step",
      promptDetail: "Ask whether they want a demo, pricing follow-up, or written information.",
      options: [
        { value: "book-demo", label: "Book a demo" },
        { value: "pricing-info", label: "Send pricing info" },
        { value: "product-details", label: "Send product details" },
      ],
    },
  ],
};
