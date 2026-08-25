import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, PageHero } from "../../_components/content";
import { MarketingVideo } from "@/components/marketing-video";
import { SolutionCta } from "@/components/solution-cta";
import { getSolution, solutions } from "@/lib/solutions";
import { absoluteUrl, createMetadata } from "@/lib/seo";
import styles from "../../content.module.css";

export function generateStaticParams() {
  return solutions.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const solution = getSolution((await params).slug);
  if (!solution) return {};
  return createMetadata({
    title: solution.title,
    description: solution.description,
    path: `/solutions/${solution.slug}`,
  });
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const solution = getSolution((await params).slug);
  if (!solution) notFound();

  const url = absoluteUrl(`/solutions/${solution.slug}`);
  const showMarketingVideo = ["voice-form", "conversational-forms", "voice-survey"].includes(solution.slug);
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      name: solution.title,
      description: solution.description,
      url,
      mainEntity: { "@id": `${url}#definition` },
    },
    {
      "@type": "DefinedTerm",
      "@id": `${url}#definition`,
      name: solution.query,
      description: solution.definition,
      url,
    },
    {
      "@type": "FAQPage",
      mainEntity: solution.questions.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  if (showMarketingVideo) {
    graph.push({
      "@type": "VideoObject",
      name: `See how Talkform turns a ${solution.query} into structured answers`,
      description: "A 38-second product demonstration of a guided Talkform interview and its reviewable structured result.",
      thumbnailUrl: absoluteUrl("/videos/talkform-demo-poster.jpg"),
      contentUrl: absoluteUrl("/videos/talkform-demo.mp4"),
      uploadDate: "2026-08-23",
      duration: "PT38S",
    });
  }

  return (
    <main className={styles.page}>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />
      <PageHero eyebrow={solution.eyebrow} title={solution.title} description={solution.description} />

      {showMarketingVideo ? (
        <section className={styles.section}>
          <MarketingVideo
            videoId={`solution-${solution.slug}`}
            title={`See a ${solution.query} produce a reviewable result`}
            description="Watch the interview collect defined fields, then inspect the structured output. The demo uses sample data and does not claim a conversion lift."
            src="/videos/talkform-demo.mp4"
            poster="/videos/talkform-demo-poster.jpg"
            captions="/videos/talkform-demo.vtt"
            eyebrow="38-second product walkthrough"
          />
          <div className={styles.actions}>
            <Link href="/pilot" className={styles.primaryButton} data-agent-action="request-pilot">
              Run one measured pilot
            </Link>
            <Link href="/import" className={styles.secondaryButton} data-agent-action="import-form">
              Convert my public form
            </Link>
          </div>
        </section>
      ) : null}

      <article className={styles.prose}>
        <section>
          <h2>What is a {solution.query}?</h2>
          <p>{solution.definition}</p>
        </section>

        <section>
          <h2>When it fits</h2>
          <ul>{solution.bestFor.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <section>
          <h2>A practical workflow</h2>
          <ol>{solution.workflow.map((item) => <li key={item}>{item}</li>)}</ol>
        </section>

        <section>
          <h2>Tradeoffs to plan for</h2>
          <ul>{solution.tradeoffs.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>
            For implementation details, review the <Link href="/docs">Talkform documentation</Link>,
            the <Link href="/security">security model</Link>, and the related <Link href="/use-cases">use cases</Link>.
          </p>
        </section>

        <section>
          <h2>Frequently asked questions</h2>
          {solution.questions.map((item) => (
            <div key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </section>
      </article>

      <SolutionCta solutionSlug={solution.slug} templateId={solution.templateId} />
    </main>
  );
}
