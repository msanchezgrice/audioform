import { SignUp } from "@clerk/nextjs";
import { PageHero, Prose } from "../_components/content";
import styles from "../content.module.css";

export default function SignUpPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return <main className={styles.page}>
    <PageHero eyebrow="Account" title="Create a Talkform account" description="Join the paid handoff pilot after reviewing the product and its current data boundary." />
    {configured ? <div className={styles.prose}><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></div> : <Prose><p>Self-serve signup is not active yet. Email <a href="mailto:support@talkform.ai">support@talkform.ai</a> to join the Pro pilot.</p></Prose>}
  </main>;
}
