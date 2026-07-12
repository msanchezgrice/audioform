import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Prose } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "Changelog", description: "Public Talkform changes to content, discovery, trust, onboarding, and the guided interview experience.", path: "/changelog" });

export default function ChangelogPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Changelog" title="What changed" description="A public record of material website and product-surface changes. Internal fixes may be grouped into release notes." />
    <Prose>
      <h2>July 12, 2026 — launch-readiness hardening</h2>
      <ul><li>Added privacy, terms, cookies, security, subprocessors, accessibility, contact, pricing, FAQ, status, and about pages.</li><li>Added eight long-form referenced guides, tag pages, related articles, and an RSS feed.</li><li>Added ten use-case pages and provider-specific import guidance.</li><li>Added canonical metadata, structured data, robots instructions, and complete sitemap coverage.</li><li>Expanded onboarding, accessibility, failure recovery, and security controls; see the current product and repository for verified scope.</li></ul>
      <h2>Before this record</h2>
      <p>The public changelog was not maintained. Existing demos, documentation, importer behavior, and developer packages predate this page and should not be assigned invented release dates.</p>
      <p>Questions can be sent to <a href="mailto:support@talkform.ai">support@talkform.ai</a>. See <Link href="/status">service status</Link> for incident notes.</p>
    </Prose>
  </main>;
}
