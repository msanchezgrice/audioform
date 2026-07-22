import Link from "next/link";
import { PageHero, Prose } from "../../_components/content";
import styles from "../../content.module.css";

export default function BillingSuccessPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Billing" title="Stripe received the checkout" description="Talkform grants access from verified subscription events, not from this return page." />
    <Prose><p>You can close this page or return to the <Link href="/app">demo</Link>. If your account does not update after the verified webhook is processed, email <a href="mailto:support@talkform.ai">support@talkform.ai</a>.</p></Prose>
  </main>;
}
