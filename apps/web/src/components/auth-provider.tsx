import { ClerkProvider } from "@clerk/nextjs";
import { AuthAnalytics } from "./auth-analytics";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  return publishableKey
    ? <ClerkProvider publishableKey={publishableKey}><AuthAnalytics />{children}</ClerkProvider>
    : children;
}
