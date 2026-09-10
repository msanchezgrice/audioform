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
  return (
    <main className={styles.page}>
      <PageHero eyebrow="Evidence · September 10, 2026" title="What Talkform’s agent readiness evidence actually proves" description="A small, named denominator with reproducible checks—without treating protocol files as search-ranking guarantees." />
      <Prose>
        <h2>Current result</h2>
        <p><strong>The September 9, 2026 release verification completed the authenticated REST and hosted MCP handoff loop.</strong> It checked project-key authorization, handoff creation, respondent review and submission, independent structured-result retrieval, MCP initialization and hosted lifecycle tools, and deletion behavior. The CI regression suite passed 180 tests plus two browser onboarding checks. This is release evidence for those checks, not a claim that every agent, query, form provider, browser, voice session, or downstream system will succeed.</p>
        <p>The named public discovery and task route check previously recorded 15 of 15 HTTP 200 responses for the deployed revision checked on July 22, 2026. That historical reachability result does not establish current search placement or citation frequency.</p>
        <h2>Live voice deadline</h2>
        <p>On September 10, 2026, one production test used synthetic silent audio and a brief provider response. The server began ending the call at its 180-second deadline, confirmed termination 2.2 seconds later, and the realtime connection stopped before browser cleanup. The matching durable Workflow deadline step completed successfully. Both server controls ran close together; this check does not prove which issued the first hangup or test recovery from a server process failure.</p>
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
        <p>These checks do not prove search placement, citation frequency, cross-agent compatibility, voice quality, conversion lift, or downstream processing. The local MCP package remains a schema, template, and validation surface; the hosted project tools require a project key and the explicit retention and deletion contract described in the current documentation.</p>
        <h2>Follow the implementation</h2>
        <p>See the <Link href="/docs/agents">agent workflow</Link>, <Link href="/docs/mcp">MCP install path</Link>, <Link href="/security">security boundary</Link>, and <Link href="/changelog">changelog</Link>.</p>
      </Prose>
    </main>
  );
}
