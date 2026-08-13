import type { Metadata } from "next";
import { CardGrid, ContentCard, JsonLd, PageHero } from "../_components/content";
import { solutions } from "@/lib/solutions";
import { absoluteUrl, createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({
  title: "Voice and conversational form guides",
  description: "Compare voice forms, conversational forms, chat forms, and voice surveys, then try each pattern with a reviewable Talkform demo.",
  path: "/solutions",
});

export default function SolutionsPage() {
  return (
    <main className={styles.page}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Talkform solution guides",
        description: "Practical guides to structured voice and text form experiences.",
        url: absoluteUrl("/solutions"),
        hasPart: solutions.map((solution) => ({
          "@type": "WebPage",
          name: solution.title,
          url: absoluteUrl(`/solutions/${solution.slug}`),
        })),
      }} />
      <PageHero
        eyebrow="Choose the interaction that fits the form"
        title="Voice, chat, and conversational form guides"
        description="These patterns share a schema and a review step, but they solve different intake problems. Compare the tradeoffs before changing the interface."
      />
      <CardGrid>
        {solutions.map((solution) => (
          <ContentCard
            key={solution.slug}
            href={`/solutions/${solution.slug}`}
            eyebrow={solution.query}
            title={solution.title}
            description={solution.description}
            meta={`Try the ${solution.templateId.replaceAll("-", " ")} demo`}
          />
        ))}
      </CardGrid>
    </main>
  );
}
