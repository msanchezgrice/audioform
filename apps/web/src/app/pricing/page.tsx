import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import { pricingPlans } from "@/lib/pricing";
import { CommercialLink } from "./commercial-link";
import { CheckoutButton } from "./checkout-button";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "Pricing", description: "Talkform pricing for browser evaluation, production voice interviews, agent handoffs, and team pilots.", path: "/pricing" });

export default function PricingPage() {
  const checkoutEnabled = process.env.NEXT_PUBLIC_TALKFORM_CHECKOUT_ENABLED === "true";
  return <main className={styles.page}>
    <PageHero eyebrow="Pricing" title="Start free. Move to Pro when the workflow fits." description="Clear launch pricing for guided voice interviews and agent handoffs, with hard limits instead of surprise overages." />
    <section className={styles.cardGrid} aria-label="Talkform plans">
      {pricingPlans.map((plan) => (
        <article className={styles.card} key={plan.slug}>
          <span className={styles.eyebrow}>{plan.name}</span>
          <h2>{plan.monthlyPriceUsd === null ? "Let’s scope it" : plan.monthlyPriceUsd === 0 ? "$0" : `$${plan.monthlyPriceUsd}/month`}</h2>
          {plan.annualPriceUsd ? <small>${plan.annualPriceUsd}/year — two months free</small> : null}
          <p>{plan.summary}</p>
          <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <p><small>{plan.limitPolicy}</small></p>
          {plan.slug === "free" ? (
            <Link className={styles.secondaryButton} href="/app" data-agent-action="try-free">Try the demo</Link>
          ) : plan.slug === "pro" && checkoutEnabled ? (
            <CheckoutButton className={styles.primaryButton} />
          ) : (
            <CommercialLink
              className={styles.primaryButton}
              plan={plan.slug}
              href={`mailto:support@talkform.ai?subject=${encodeURIComponent(`Talkform ${plan.name}`)}&body=${encodeURIComponent(`I’m interested in the ${plan.name} plan. My use case is:`)}`}
              data-agent-action={plan.slug === "pro" ? "start-pro" : "request-pilot"}
            >{plan.slug === "pro" ? "Start Pro" : "Request a pilot"}</CommercialLink>
          )}
        </article>
      ))}
    </section>
    <section className={styles.prose}>
      <h2>Commercial availability</h2>
      <p>Pro is the launch offer and target price. Checkout opens after Talkform&apos;s account-backed handoff, customer authentication, and subscription entitlement path are live. Until then, the button starts a direct pilot conversation and no card is charged.</p>
      <h2>Why 100 minutes?</h2>
      <p>Realtime voice has a variable provider cost, while ordinary form responses do not. The launch plan uses a visible hard limit so early customers can predict spend while Talkform measures actual interview length and model usage.</p>
      <h2>Data boundary</h2>
      <p>The public demo remains browser-local. A paid hosted workflow will store reviewed structured answers only for the stated result window—not raw microphone audio or an indefinite transcript archive. See <Link href="/privacy">privacy</Link> and <Link href="/security">security</Link>.</p>
    </section>
  </main>;
}
