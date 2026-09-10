export type PricingPlan = {
  slug: "free";
  name: string;
  summary: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  dailyHandoffs: number;
  agentDailyHandoffs: number;
  respondentLinkDays: number;
  completedResultAccessDays: number;
  voiceAvailability: string;
  features: string[];
  limitPolicy: string;
};

export const pricingPlans: PricingPlan[] = [
  {
    slug: "free",
    name: "Free",
    summary: "Collect human answers for your agent without a card or a business email.",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    dailyHandoffs: 100,
    agentDailyHandoffs: 10,
    respondentLinkDays: 7,
    completedResultAccessDays: 7,
    voiceAvailability: "Optional after human claim; capped by shared limits",
    features: [
      "Core text handoffs are free",
      "Agent workspaces start with up to 10 text handoffs per day",
      "Human-owned projects can create up to 100 text handoffs per day",
      "Respondent links stay open for 7 days",
      "Completed results stay available for 7 days",
      "Optional voice is capped under shared limits",
      "Browser demo, public-form importer, and local JSON export",
    ],
    limitPolicy: "Paid voice requires an optional verified human claim. New handoff creation observes shared fair-use capacity of 1,000 per UTC day and remains bounded per project. Usage may be temporarily limited; no production SLA is promised.",
  },
];
