import type { Metadata } from "next";
import { CardGrid, ContentCard, JsonLd, PageHero, PrimaryCta } from "../_components/content";
import { useCases } from "@/lib/content";
import { absoluteUrl, createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({
  title: "Voice form use cases",
  description: "Explore ten practical Talkform use cases with suggested fields, workflow steps, limitations, and related implementation guidance.",
  path: "/use-cases",
});

export default function UseCasesPage() {
  return (
    <main className={styles.page}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Talkform use cases",
        url: absoluteUrl("/use-cases"),
        hasPart: useCases.map((entry) => ({ "@type": "WebPage", name: entry.title, url: absoluteUrl(`/use-cases/${entry.slug}`) })),
      }} />
      <PageHero eyebrow="Use cases" title="Guided interviews for real workflows" description="Each pattern includes a field set, a practical flow, important limitations, and linked implementation guidance." />
      <CardGrid>
        {useCases.map((entry) => (
          <ContentCard key={entry.slug} href={`/use-cases/${entry.slug}`} eyebrow={entry.audience} title={entry.title} description={entry.description} />
        ))}
      </CardGrid>
      <PrimaryCta />
    </main>
  );
}
