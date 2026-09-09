import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { PageHero, Prose } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({
  title: "Sign in",
  description: "Sign in to a Talkform account.",
  path: "/sign-in",
  noIndex: true,
});

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return <main className={styles.page}>
    <PageHero eyebrow="Account" title="Sign in to Talkform" description="Use your account to manage projects and integration access. The browser demo remains available without an account." />
    {configured ? <div className={styles.prose}><SignIn fallbackRedirectUrl="/dashboard" routing="path" path="/sign-in" signUpUrl="/sign-up" /></div> : <Prose><p>Account sign-in is being configured. You can still try the public demo, or email <a href="mailto:support@talkform.ai">support@talkform.ai</a> for help getting started.</p></Prose>}
  </main>;
}
