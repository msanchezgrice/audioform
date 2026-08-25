import type { Metadata } from "next";
import Link from "next/link";
import { PilotForm } from "./pilot-form";
import { createMetadata } from "@/lib/seo";
import styles from "./pilot.module.css";

export const metadata: Metadata = createMetadata({
  title: "Guided conversational-form pilot",
  description: "Run one form and one workflow as a measured Talkform pilot, with a reviewed implementation plan and optional one-time Stripe payment.",
  path: "/pilot",
});

function safeInitialUrl(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export default async function PilotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const source = typeof query.source === "string" ? query.source.slice(0, 80) : "pilot_page";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Guided pilot</span>
          <h1>Prove one conversational workflow before scaling it.</h1>
          <p>
            Bring one form and one workflow. We&apos;ll define what success means, configure the interview, and review the measured result with you.
          </p>
          <div className={styles.proofLine} aria-label="Pilot boundaries">
            <div><strong>One form</strong><span>A bounded starting point</span></div>
            <div><strong>One workflow</strong><span>A real destination and owner</span></div>
            <div><strong>Measured</strong><span>Agreed completion criteria</span></div>
          </div>
        </div>
        <PilotForm
          initialFormUrl={safeInitialUrl(query.formUrl)}
          source={source}
          checkoutCancelled={query.checkout === "cancelled"}
        />
      </section>

      <section className={styles.scopeGrid} aria-label="Guided pilot process">
        <article className={styles.scopeCard}>
          <span className={styles.eyebrow}>01 · Define</span>
          <h2>Agree on the result</h2>
          <p>We document the form, intended audience, destination, and the exact completion evidence before collecting production data.</p>
        </article>
        <article className={styles.scopeCard}>
          <span className={styles.eyebrow}>02 · Run</span>
          <h2>Use a controlled workflow</h2>
          <p>Voice remains optional, text remains available, and respondents review structured fields before any approved handoff.</p>
        </article>
        <article className={styles.scopeCard}>
          <span className={styles.eyebrow}>03 · Decide</span>
          <h2>Review measured evidence</h2>
          <p>We compare the agreed criteria and decide whether to improve, expand, or stop. We do not promise a fabricated conversion lift.</p>
        </article>
      </section>

      <section className={styles.scopeCard}>
        <h2>Payment boundary</h2>
        <p>
          An accepted pilot may be paid once through Stripe Checkout. Stripe presents the exact price before payment. The guided pilot is one-time and does not activate a recurring subscription. Read the <Link className={styles.textLink} href="/terms">commercial terms</Link> before paying.
        </p>
      </section>
    </main>
  );
}
