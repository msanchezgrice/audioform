import type { Metadata } from "next";
import { ImportWorkbench } from "@/components/import-workbench";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Free conversational form converter",
  description: "Convert a public Google Form, Typeform, or other form into an editable conversational voice or text interview preview.",
  path: "/import",
});

export default function ImportPage() {
  return <ImportWorkbench vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""} />;
}
