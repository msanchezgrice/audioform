import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Prose } from "../../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../../content.module.css";

export const metadata: Metadata = createMetadata({
  title: "Agent readiness evidence",
  description: "A dated, reproducible account of Talkform discovery routes, browser-task coverage, and current limitations.",
  path: "/evidence/agent-readiness",
});

const checkedRoutes = [
  "/", "/app", "/import", "/pricing", "/docs", "/docs/mcp", "/agents.md", "/llms.txt",
  "/.well-known/ai-agent.json", "/.well-known/agent-card.json", "/schemas/audioform-config.json",
  "/schemas/audioform-session-result.json", "/use-cases/user-research", "/import/typeform", "/faq",
];

export default function AgentReadinessEvidencePage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Evidence · July 22, 2026" title="What Talkform’s agent readiness evidence actually proves" description="A small, named denominator with reproducible checks—without treating protocol files as search-ranking guarantees." />
    <Prose>
      <h2>Current result</h2>
      <p><strong>15 of 15 named public discovery and task routes returned HTTP 200</strong> on July 22, 2026. The repository test suite also covers the text interview path, required-field progress, correction, review, and local export. This is release evidence, not a claim that every agent, query, form provider, or browser will succeed.</p>
      <h2>Route denominator</h2>
      <ul>{checkedRoutes.map((route) => <li key={route}><code>{route}</code></li>)}</ul>
      <h2>Reproduce the route check</h2>
      <pre><code>{`for route in / /app /import /pricing /docs /docs/mcp /agents.md /llms.txt \\
  /.well-known/ai-agent.json /.well-known/agent-card.json \\
  /schemas/audioform-config.json /schemas/audioform-session-result.json \\
  /use-cases/user-research /import/typeform /faq; do
  curl -L -sS -o /dev/null -w "%{http_code} $route\\n" "https://www.talkform.ai$route"
done`}</code></pre>
      <h2>What remains unproven</h2>
      <p>This check does not prove search placement, citation frequency, cross-agent compatibility, production handoff durability, or conversion lift. Talkform’s current MCP package is local schema/template tooling. Hosted handoff and remote MCP remain gated on durable account storage, authorization, retention, and deletion controls.</p>
      <h2>Follow the implementation</h2>
      <p>See the <Link href="/docs/agents">agent workflow</Link>, <Link href="/docs/mcp">MCP install path</Link>, <Link href="/security">security boundary</Link>, and <Link href="/changelog">changelog</Link>.</p>
    </Prose>
  </main>;
}
