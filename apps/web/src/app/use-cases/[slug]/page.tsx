import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, PageHero, PrimaryCta } from "../../_components/content";
import { getUseCase, useCases } from "@/lib/content";
import { getBlogPostSummary } from "@/lib/blog";
import { absoluteUrl, createMetadata } from "@/lib/seo";
import styles from "../../content.module.css";

export function generateStaticParams() {
  return useCases.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const entry = getUseCase((await params).slug);
  if (!entry) return {};
  return createMetadata({ title: entry.title, description: entry.description, path: `/use-cases/${entry.slug}` });
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const entry = getUseCase((await params).slug);
  if (!entry) notFound();
  return (
    <main className={styles.page}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: entry.title,
        description: entry.description,
        url: absoluteUrl(`/use-cases/${entry.slug}`),
        audience: { "@type": "Audience", audienceType: entry.audience },
      }} />
      <PageHero eyebrow={entry.audience} title={entry.title} description={entry.description} />
      <div className={styles.facts}>
        <section className={styles.fact}>
          <h2>Suggested fields</h2>
          <ul>{entry.fields.map((field) => <li key={field}>{field}</li>)}</ul>
        </section>
        <section className={styles.fact}>
          <h2>Recommended workflow</h2>
          <ol>{entry.workflow.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
        <section className={styles.fact}>
          <h2>Important limitations</h2>
          <ul>{entry.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        </section>
        <section className={styles.fact}>
          <h2>Related guidance</h2>
          <ul>{entry.relatedPosts.map((slug) => {
            const post = getBlogPostSummary(slug);
            return post ? <li key={slug}><Link href={`/blog/${slug}`}>{post.title}</Link></li> : null;
          })}</ul>
        </section>
      </div>
      <PrimaryCta />
    </main>
  );
}
