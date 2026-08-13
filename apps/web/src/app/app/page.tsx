import type { Metadata } from "next";
import {
  AUDIOFORM_TEMPLATES,
  getAudioformTemplate,
} from "@talkform/core";
import { DemoTemplateGallery } from "@/components/demo-template-gallery";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Talkform demo",
  description: "Try a guided voice or text interview, review captured fields, and inspect the structured result.",
  path: "/app",
  noIndex: true,
});

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string | string[] }>;
}) {
  const requestedTemplate = (await searchParams).template;
  const templateId = typeof requestedTemplate === "string" && getAudioformTemplate(requestedTemplate)
    ? requestedTemplate
    : AUDIOFORM_TEMPLATES[0]?.id;

  return (
    <DemoTemplateGallery
      templates={AUDIOFORM_TEMPLATES}
      initialTemplateId={templateId}
      vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""}
      voiceEnabled={process.env.TALKFORM_ENABLE_PUBLIC_REALTIME === "true"}
    />
  );
}
