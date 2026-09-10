import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthFallback, AuthMachineNote, AuthPage, authAppearance } from "../../components/auth-page";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Sign in",
  description: "Sign in to a Talkform account.",
  path: "/sign-in",
  noIndex: true,
});

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return <AuthPage eyebrow="Account" title="Sign in to Talkform" description="Manage your projects, API keys, and integrations.">
    {configured ? <SignIn appearance={authAppearance} fallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" routing="path" path="/sign-in" signUpUrl="/sign-up" /> : <AuthFallback><p>Account sign-in is being configured. You can still try the public demo, or email <a href="mailto:support@talkform.ai">support@talkform.ai</a> for help getting started.</p></AuthFallback>}
    <AuthMachineNote />
  </AuthPage>;
}
