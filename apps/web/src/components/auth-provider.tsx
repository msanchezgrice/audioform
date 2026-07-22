import { ClerkProvider } from "@clerk/nextjs";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  return publishableKey ? <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider> : children;
}
