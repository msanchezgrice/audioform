import type { Metadata } from "next";
import { PolicyPage } from "../_components/content";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({ title: "Subprocessors", description: "Service providers Talkform relies on for hosting and realtime AI processing, with purpose and documentation links.", path: "/subprocessors" });

export default function SubprocessorsPage() {
  return <PolicyPage eyebrow="Trust" title="Subprocessors" description="This public list names core providers evident in the current Talkform deployment. Contractual scope and data location depend on account configuration." sections={[
    { title: "OpenAI", content: <p>Purpose: realtime AI audio, transcription, response generation, and structured tool calls. Information may include audio, prompt context, transcripts, and fields needed for a session. Review <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noreferrer">OpenAI&apos;s privacy policy</a> and API data controls. Actual retention and regional configuration must be verified in the Talkform account.</p> },
    { title: "Vercel", content: <p>Purpose: web application hosting, request routing, server execution, and operational logs. Information may include request metadata, IP address, browser information, and application data handled by deployed functions. Review <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel&apos;s privacy policy</a>.</p> },
    { title: "Changes and questions", content: <p>Additional monitoring, storage, email, or analytics providers should be added before their production activation. We may update this list as infrastructure changes. Questions or requests concerning a customer-controlled interview can be sent to the form owner or to <a href="mailto:support@talkform.ai">support@talkform.ai</a>.</p> },
  ]} />;
}
