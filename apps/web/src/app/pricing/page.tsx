import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Prose } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "Pricing", description: "Current Talkform pricing status and what to evaluate before choosing a future production plan.", path: "/pricing" });

export default function PricingPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Pricing" title="Public pricing is not yet published" description="Talkform is still hardening its production, privacy, security, and onboarding surfaces. We will publish clear plan limits before charging self-serve customers." />
    <Prose>
      <h2>What to expect</h2>
      <p>Future pricing should explain included interview minutes, realtime model usage, storage and retention, team access, import limits, support, overages, and cancellation in plain language. No amount or plan on this page is an offer today.</p>
      <h2>Evaluate the product</h2>
      <p>You can try the current browser demo and public-form importer. Do not treat a demo session as a production data-processing agreement or service-level commitment.</p>
      <h2>Questions</h2>
      <p>Email <a href="mailto:support@talkform.ai">support@talkform.ai</a> or <Link href="/app">try the demo</Link>. We will not fabricate enterprise pricing or a launch discount before the commercial terms exist.</p>
    </Prose>
  </main>;
}
