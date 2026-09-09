import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { PageHero, Prose } from "../_components/content";
import styles from "../content.module.css";
import { SignupFlowTracker } from "../../components/auth-analytics";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Create an account",
  description: "Create a Talkform account.",
  path: "/sign-up",
  noIndex: true,
});

export default function SignUpPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return <main className={styles.page}>
    <PageHero eyebrow="Account" title="Create a Talkform account" description="Create a free account to own a project and access integrations. No payment or business email is required." />
    {configured ? <><SignupFlowTracker /><div className={styles.prose}><SignUp fallbackRedirectUrl="/dashboard" routing="path" path="/sign-up" signInUrl="/sign-in" /></div></> : <Prose><p>Self-serve signup is not active yet. Email <a href="mailto:support@talkform.ai">support@talkform.ai</a> for help getting started.</p></Prose>}
  </main>;
}
