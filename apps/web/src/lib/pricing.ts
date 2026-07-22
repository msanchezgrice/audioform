export type PricingPlan = {
  slug: "free" | "pro" | "pilot";
  name: string;
  summary: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  includedVoiceMinutes: number | null;
  includedHandoffs: number | null;
  features: string[];
  limitPolicy: string;
};

export const pricingPlans: PricingPlan[] = [
  {
    slug: "free",
    name: "Free",
    summary: "Evaluate Talkform locally before you commit.",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    includedVoiceMinutes: 20,
    includedHandoffs: 0,
    features: ["Browser voice and text demo", "Public-form importer", "Local JSON and Markdown export", "Local MCP schemas and templates"],
    limitPolicy: "Evaluation use only; no hosted retention, shared workspace, or production SLA.",
  },
  {
    slug: "pro",
    name: "Pro",
    summary: "For one operator running production interviews and agent handoffs.",
    monthlyPriceUsd: 29,
    annualPriceUsd: 290,
    includedVoiceMinutes: 100,
    includedHandoffs: 100,
    features: ["100 realtime voice minutes per month", "100 hosted handoffs per month", "Account-scoped API key and remote MCP", "24-hour reviewed-result availability"],
    limitPolicy: "A hard limit applies during launch; there are no surprise overages. Contact us to raise a limit.",
  },
  {
    slug: "pilot",
    name: "Team pilot",
    summary: "For teams that need more volume, seats, retention, or a security review.",
    monthlyPriceUsd: null,
    annualPriceUsd: null,
    includedVoiceMinutes: null,
    includedHandoffs: null,
    features: ["Scoped implementation review", "Custom volume and retention", "Team access planning", "Security and data-flow review"],
    limitPolicy: "Pilot scope and price are agreed in writing before production data is collected.",
  },
];
