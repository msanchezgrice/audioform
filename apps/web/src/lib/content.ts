import providers from "@/content/providers.json";
import useCaseEntries from "@/content/use-cases.json";

export type UseCase = (typeof useCaseEntries)[number];
export type ProviderImport = (typeof providers)[number];

export const useCases = useCaseEntries;
export const providerImports = providers;

export function getUseCase(slug: string) {
  return useCases.find((entry) => entry.slug === slug) ?? null;
}

export function getProviderImport(slug: string) {
  return providerImports.find((entry) => entry.slug === slug) ?? null;
}
