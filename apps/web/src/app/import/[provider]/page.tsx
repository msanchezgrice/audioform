import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, PageHero } from "../../_components/content";
import { getProviderImport, providerImports } from "@/lib/content";
import { absoluteUrl, createMetadata } from "@/lib/seo";
import styles from "../../content.module.css";

export function generateStaticParams() {
  return providerImports.map((entry) => ({ provider: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ provider: string }> }): Promise<Metadata> {
  const entry = getProviderImport((await params).provider);
  if (!entry) return {};
  return createMetadata({
    title: `${entry.name} to voice form`,
    description: entry.description,
    path: `/import/${entry.slug}`,
  });
}

export default async function ProviderImportPage({ params }: { params: Promise<{ provider: string }> }) {
  const entry = getProviderImport((await params).provider);
  if (!entry) notFound();
  return (
    <main className={styles.page}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: `Convert ${entry.name} to a Talkform draft`,
        description: entry.description,
        url: absoluteUrl(`/import/${entry.slug}`),
        step: entry.steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, text: step })),
      }} />
      <PageHero eyebrow="Provider import guide" title={`${entry.name} to voice form`} description={entry.description} />
      <div className={styles.facts}>
        <section className={styles.fact}>
          <h2>What maps into a draft</h2>
          <ul>{entry.maps.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className={styles.fact}>
          <h2>Migration steps</h2>
          <ol>{entry.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
        <section className={styles.fact}>
          <h2>Known limitations</h2>
          <ul>{entry.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        </section>
        <section className={styles.fact}>
          <h2>Source documentation</h2>
          <p>Review the provider&apos;s current documentation before relying on a migration.</p>
          <a href={entry.reference} target="_blank" rel="noreferrer">Open {entry.name} documentation</a>
        </section>
      </div>
      <aside className={styles.ctaBand}>
        <div><h2>Import a public form</h2><p>Talkform creates an editable draft. Review every field before collecting answers.</p></div>
        <div className={styles.actions}><Link className={styles.primaryButton} href="/import">Open importer</Link></div>
      </aside>
    </main>
  );
}
