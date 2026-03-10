import { AI_SKILL_TUTOR_TEMPLATE } from "@talkform/core";
import { AudioformClient } from "@/components/audioform-client";

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
