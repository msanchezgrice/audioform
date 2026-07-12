import type { Metadata } from "next";
import { AI_SKILL_TUTOR_TEMPLATE } from "@talkform/core";
import { AudioformClient } from "@/components/audioform-client";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "AI skill tutor example",
  description: "A Talkform example that gathers learning goals and context through a guided browser interview.",
  path: "/examples/ai-skill-tutor",
  noIndex: true,
});

export default function ExamplePage() {
  return (
    <AudioformClient
      config={AI_SKILL_TUTOR_TEMPLATE}
      heading="AI Skill Tutor example"
      subheading="This is the original onboarding flow, now expressed as a reusable Talkform template."
      vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""}
    />
  );
}
