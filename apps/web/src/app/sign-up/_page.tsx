import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthFallback, AuthMachineNote, AuthPage, authAppearance } from "../../components/auth-page";
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
  return <AuthPage eyebrow="Account" title="Create a free account" description="Create a workspace to manage your projects and integrations. No card required.">
    {configured ? <><SignupFlowTracker /><SignUp appearance={authAppearance} fallbackRedirectUrl="/dashboard" signInFallbackRedirectUrl="/dashboard" routing="path" path="/sign-up" signInUrl="/sign-in" /></> : <AuthFallback><p>Self-serve signup is not active yet. Email <a href="mailto:support@talkform.ai">support@talkform.ai</a> for help getting started.</p></AuthFallback>}
    <AuthMachineNote />
  </AuthPage>;
}
