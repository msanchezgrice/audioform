import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import { pricingPlans } from "@/lib/pricing";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "Free pricing", description: "Talkform gives agents free core text handoffs, with optional voice after a verified human claim.", path: "/pricing" });

export default function PricingPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Pricing" title="Free core text handoffs" description="Register an agent, ask a person for a reviewed answer, and continue with JSON. Voice stays optional and capped." />
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
      <p>Machine workspaces start with up to 10 hosted text handoffs per day. An optional signed-in human claim enables up to 100 hosted text handoffs per day per project and optional voice under shared limits. Respondent links remain available for 7 days, and completed results remain available for 7 days.</p>
      <h2>Start with an agent</h2>
      <p>Register a machine workspace without an email or Clerk account, save its one-time project secret, and use it from a trusted agent process. No payment or business email is required for the free core.</p>
      <h2>Data boundary</h2>
      <p>The public demo remains browser-local. Hosted workflows retain reviewed structured results only for the stated 7-day access window. See <Link href="/privacy">privacy</Link> and <Link href="/security">security</Link>.</p>
    </section>
  </main>;
}
