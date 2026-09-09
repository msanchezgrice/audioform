"use client";

import Link from "next/link";

export function CheckoutButton({ className }: { className?: string }) {
  return <Link className={className} href="/dashboard" data-agent-action="get-started-free">Get started free</Link>;
}
