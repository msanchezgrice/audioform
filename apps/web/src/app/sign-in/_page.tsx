import { SignIn } from "@clerk/nextjs";
import { PageHero, Prose } from "../_components/content";
import styles from "../content.module.css";

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return <main className={styles.page}>
    <PageHero eyebrow="Account" title="Sign in to Talkform" description="Accounts are used for paid handoffs, API keys, and billing—not for the browser-local demo." />
    {configured ? <div className={styles.prose}><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" /></div> : <Prose><p>Account sign-in is being configured. You can still try the public demo, or email <a href="mailto:support@talkform.ai">support@talkform.ai</a> about the Pro pilot.</p></Prose>}
  </main>;
}
