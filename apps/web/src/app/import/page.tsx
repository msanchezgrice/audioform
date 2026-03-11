import type { Metadata } from "next";
import { ImportWorkbench } from "@/components/import-workbench";

export const metadata: Metadata = {
  title: "Import a form",
  description: "Paste a public form URL, extract its fields, and launch an editable Talkform draft.",
};

export default function ImportPage() {
  return <ImportWorkbench vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""} />;
}
