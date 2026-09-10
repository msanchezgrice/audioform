"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./workspace-navigation.module.css";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const workspace = path === "/dashboard" || path?.startsWith("/dashboard/");
  return <div className={`siteShell${workspace ? " workspaceShell" : ""}`}>{children}</div>;
}

function AnonymousNavigation({ mobile }: { mobile: boolean }) {
  return <><Link href="/sign-in" prefetch={false} data-testid={mobile ? undefined : "nav-link-sign-in"}>Sign in</Link><Link href="/docs/getting-started" prefetch={false} className={mobile ? "mobileNavCta" : "ctaNav"} data-agent-action="get-started-free" data-testid={mobile ? undefined : "nav-cta-get-started-free"}>Agent quickstart</Link><Link href="/dashboard" prefetch={false} className={mobile ? "mobileNavSecondary" : "navSecondary"} data-agent-action="open-human-workspace">Open dashboard</Link></>;
}

function AuthenticatedNavigation({ mobile }: { mobile: boolean }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || !isSignedIn) return <AnonymousNavigation mobile={mobile} />;
  return <div className={styles.controls}><Link href="/dashboard" prefetch={false} data-testid={mobile ? undefined : "nav-workspace"}>Workspace</Link><SwitchAccountButton /></div>;
}

export function NavigationAccount({ enabled, mobile = false }: { enabled: boolean; mobile?: boolean }) {
  return enabled ? <AuthenticatedNavigation mobile={mobile} /> : <AnonymousNavigation mobile={mobile} />;
}

export function SwitchAccountButton({ label = "Sign out" }: { label?: string }) {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <span className={styles.switchAccount}><button type="button" disabled={busy} onClick={async () => {
    setBusy(true); setError(false);
    try { await signOut({ redirectUrl: "/sign-in?redirect_url=/dashboard" }); }
    catch { setError(true); setBusy(false); }
  }}>{busy ? "Signing out…" : label}</button>{error && <span role="alert">Could not sign out. Try again.</span>}</span>;
}
