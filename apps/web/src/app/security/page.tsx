import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "../_components/content";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({ title: "Security", description: "Talkform security practices, responsible disclosure channel, current limitations, and guidance for safe evaluation.", path: "/security" });

export default function SecurityPage() {
  return <PolicyPage eyebrow="Trust" title="Security at Talkform" description="A transparent summary of the controls we are building, what customers should verify, and how to report a concern." sections={[
    { title: "Security principles", content: <p>Talkform is designed around least privilege, server-side validation, short-lived provider credentials, restricted access, secure transport, and collecting only information needed for the interview. Security controls continue to evolve and must be verified for the specific deployment.</p> },
    { title: "ChatGPT app boundary", content: <p>The hosted Talkform MCP endpoint exposes only three read-only, closed-world draft-preparation tools. Inputs and outputs are bounded and schema-validated; the app cannot publish forms, contact webhooks, start remote interviews, or open payment flows. It retains no tool payloads or raw network identifiers. Shared HMAC-pseudonymized request counters expire after 15 minutes, and limiter or database failures fail closed.</p> },
    { title: "Current limitations", content: <p>Talkform is an early product and does not claim SOC 2, ISO 27001, HIPAA eligibility, PCI compliance, or any other certification on this page. Customers should not use it for credentials, payment card data, protected health information, or other regulated information without a written review of architecture, contracts, retention, and incident obligations.</p> },
    { title: "Customer responsibilities", content: <p>Use least-privileged accounts, protect exports, review imported forms, avoid secrets in prompts, validate structured results, and provide appropriate participant notice and consent. Test authorization, retention, deletion, and failure recovery before production use.</p> },
    { title: "Responsible disclosure", content: <p>Send a concise report to <a href="mailto:support@talkform.ai">support@talkform.ai</a> with the affected URL or component, reproduction steps, impact, and a safe contact method. Do not access other users&apos; data, disrupt the service, or publish sensitive details before there has been a reasonable opportunity to investigate. We do not currently promise a paid bug bounty or a fixed response SLA.</p> },
    { title: "Privacy and vendors", content: <p>Security depends on data minimization, controlled vendor access, and documented retention. Review the <Link href="/privacy">privacy policy</Link> and <Link href="/subprocessors">subprocessor list</Link> alongside this page.</p> },
  ]} />;
}
