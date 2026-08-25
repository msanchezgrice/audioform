import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Prose } from "../../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../../content.module.css";

export const metadata: Metadata = createMetadata({
  title: "Guided pilot payment received",
  description: "Return page for a Talkform guided-pilot payment.",
  path: "/pilot/success",
  noIndex: true,
});

export default function PilotSuccessPage() {
  return (
    <main className={styles.page}>
      <PageHero
        eyebrow="Guided pilot"
        title="Confirming your pilot payment"
        description="This return page cannot confirm completion. Talkform waits for Stripe’s signed webhook before marking the pilot paid."
      />
      <Prose>
        <p>
          You can safely close this page while verification completes. We&apos;ll use the business email on the pilot request to coordinate only after the signed webhook confirms payment. If you do not receive a follow-up, email <a href="mailto:support@talkform.ai">support@talkform.ai</a>.
        </p>
        <p><Link href="/import">Convert another public form</Link> or return to the <Link href="/">Talkform homepage</Link>.</p>
      </Prose>
    </main>
  );
}
