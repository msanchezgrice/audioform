import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import { pricingPlans } from "@/lib/pricing";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "Free pricing", description: "Talkform is free for bounded hosted text handoffs, with optional voice under shared limits.", path: "/pricing" });

export default function PricingPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Pricing" title="Get started free" description="Collect human answers for your agent with bounded hosted text handoffs and optional voice." />
    <section className={styles.cardGrid} aria-label="Talkform plans">
      {pricingPlans.map((plan) => (
        <article className={styles.card} key={plan.slug}>
          <span className={styles.eyebrow}>{plan.name}</span>
          <h2>$0</h2>
          <small>No card required</small>
          <p>{plan.summary}</p>
          <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <p><small>{plan.limitPolicy}</small></p>
          <Link className={styles.primaryButton} href="/dashboard" data-agent-action="get-started-free">Get started free</Link>
        </article>
      ))}
    </section>
    <section className={styles.prose}>
      <h2>What is included</h2>
      <p>Each project can create up to 100 hosted text handoffs per day. Respondent links remain available for 7 days, and completed results remain available for 7 days. Voice is optional and uses shared limits; exact voice quotas will be published when they are set.</p>
      <h2>Start with a project</h2>
      <p>Use Talkform for agent intake, customer research, onboarding, or any workflow that needs a reviewed human answer. Account creation is for project ownership and integration access. No payment or business email is required.</p>
      <h2>Data boundary</h2>
      <p>The public demo remains browser-local. Hosted workflows retain reviewed structured results only for the stated 7-day access window. See <Link href="/privacy">privacy</Link> and <Link href="/security">security</Link>.</p>
    </section>
  </main>;
}
