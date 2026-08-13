import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, PageHero } from "../../_components/content";
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
  const graph = [
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

  return (
    <main className={styles.page}>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />
      <PageHero eyebrow={solution.eyebrow} title={solution.title} description={solution.description} />

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
