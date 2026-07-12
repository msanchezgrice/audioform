import type { Metadata } from "next";
import {
  CUSTOMER_FEEDBACK_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
} from "@talkform/core";
import { DemoTemplateGallery } from "@/components/demo-template-gallery";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Talkform demo",
  description: "Try a guided voice or text interview, review captured fields, and inspect the structured result.",
  path: "/app",
  noIndex: true,
});

export default function AppPage() {
  return (
    <DemoTemplateGallery
      templates={[
        CUSTOMER_FEEDBACK_TEMPLATE,
        LEAD_GENERATION_TEMPLATE,
        JOB_APPLICATION_TEMPLATE,
      ]}
      vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""}
      voiceEnabled={process.env.TALKFORM_ENABLE_PUBLIC_REALTIME === "true"}
    />
  );
}
