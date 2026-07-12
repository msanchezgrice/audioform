import type { Metadata } from "next";
import { ImportWorkbench } from "@/components/import-workbench";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Import a form",
  description: "Paste a public form URL, extract its fields, and launch an editable Talkform draft.",
  path: "/import",
});

export default function ImportPage() {
  return <ImportWorkbench vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""} />;
}
