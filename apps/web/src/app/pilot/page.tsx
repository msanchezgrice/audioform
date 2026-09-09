import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Get started free",
  description: "Start a free Talkform project for bounded hosted text handoffs and optional voice.",
  path: "/pilot",
});

/**
 * Keep the historical /pilot URL usable while paid pilot acquisition is retired.
 * Existing links land in the free project onboarding surface.
 */
export default function PilotPage() {
  redirect("/dashboard");
}
