import { AI_SKILL_TUTOR_TEMPLATE } from "@talkform/core";
import { AudioformClient } from "@/components/audioform-client";

export default function AppPage() {
  return (
    <AudioformClient
      config={AI_SKILL_TUTOR_TEMPLATE}
      heading="Talkform live demo"
      subheading="Run the extracted voice-first form utility on the bundled AI Skill Tutor example template."
      vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""}
    />
  );
}
