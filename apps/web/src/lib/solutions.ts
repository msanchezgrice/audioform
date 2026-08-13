import solutionEntries from "@/content/solutions.json";

export type Solution = (typeof solutionEntries)[number];

export const solutions = solutionEntries;

export function getSolution(slug: string) {
  return solutions.find((solution) => solution.slug === slug) ?? null;
}
