export type PricingPlan = {
  slug: "free";
  name: string;
  summary: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  dailyHandoffs: number;
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
    respondentLinkDays: 7,
    completedResultAccessDays: 7,
    voiceAvailability: "Optional under shared limits",
    features: [
      "Up to 100 hosted text handoffs per day per project",
      "Respondent links stay open for 7 days",
      "Completed results stay available for 7 days",
      "Optional voice under shared limits",
      "Browser demo, public-form importer, and local JSON export",
    ],
    limitPolicy: "Usage is bounded per project and may be temporarily limited. No production SLA is promised.",
  },
];
