import Link from "next/link";
import { audioformSessionResultJsonSchema } from "@talkform/core";
import styles from "./site.module.css";

const sampleResult = {
  schemaVersion: "1.0",
  formId: "customer-intake",
  sessionId: "session_3e2z1f0c",
  status: "completed",
  completion: {
    required: 5,
    captured: 5,
    percent: 100,
    missingFieldIds: [],
  },
  currentPrompt: null,
  fields: {
    fullName: "Avery Stone",
    role: "Product Lead",
    goal: ["upskill_current_job", "ship_ai_projects"],
    aiComfort: 4,
    teamContext: "Leading a small product team at a B2B SaaS startup.",
  },
  transcript: [
    { speaker: "assistant", text: "What should I call you?", timestamp: 1 },
    { speaker: "user", text: "Avery Stone.", timestamp: 2 },
  ],
  summary: "Avery leads product at a SaaS startup and wants to ship AI projects for the current role.",
  metadata: {
    model: "gpt-realtime",
    voice: "marin",
    startedAt: "2026-03-10T12:00:00.000Z",
  },
};

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <article className={styles.heroCard}>
          <div className={styles.eyebrow}>Audio-first forms</div>
          <h1>Turn any form into a live <em>audio interview</em></h1>
          <p className={styles.lede}>
            Talkform asks questions aloud, fills structured fields from the conversation,
            and exports clean JSON for your apps, workflows, and agents.
          </p>
          <div className={styles.heroActions}>
            <Link href="/app" className={styles.primaryAction}>
              Try the demo
            </Link>
            <Link href="/import" className={styles.secondaryAction}>
              Import a form
            </Link>
            <Link href="/docs" className={styles.ghostAction}>
              Read docs
            </Link>
          </div>
        </article>

        <div className={styles.heroAside}>
          <div className={styles.ctaCard}>
            <strong>Import existing forms</strong>
            <p>Paste a public URL from Typeform, Google Forms, Jotform, or HubSpot and launch the audio version without rebuilding.</p>
          </div>
          <div className={styles.surface}>
            <strong>Developer-first integrations</strong>
            <p>MCP tools, a CLI, JSON schemas, and docs that explain exactly how to configure and consume Talkform.</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>Old way vs. <em>new way</em></h2>
            <p className={styles.sectionIntro}>
              Import your existing form and give people a conversational path that&apos;s easier to finish.
            </p>
          </div>
        </div>

        <div className={styles.comparisonGrid}>
          <article className={`${styles.compareCard} ${styles.compareOld}`}>
            <div className={styles.eyebrow}>Old way</div>
            <h3>Static forms demand attention every screen</h3>
            <div className={styles.metricList}>
              <div className={styles.metricRow}>
                <span>Steps</span>
                <strong>Open, read, scan, type, submit</strong>
              </div>
              <div className={styles.metricRow}>
                <span>Duration</span>
                <strong>Longer — easier to abandon</strong>
              </div>
              <div className={styles.metricRow}>
                <span>Completion</span>
                <strong>Lower when the form feels like work</strong>
              </div>
            </div>
          </article>

          <article className={`${styles.compareCard} ${styles.compareNew}`}>
            <div className={styles.eyebrow}>New way</div>
            <h3>Talkform carries the interview and writes the answers</h3>
            <div className={styles.metricList}>
              <div className={styles.metricRow}>
                <span>Steps</span>
                <strong>Open, answer aloud, review draft</strong>
              </div>
              <div className={styles.metricRow}>
                <span>Duration</span>
                <strong>Shorter — the host keeps momentum</strong>
              </div>
              <div className={styles.metricRow}>
                <span>Completion</span>
                <strong>Higher when the flow feels guided</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>How it <em>works</em></h2>
            <p className={styles.sectionIntro}>
              You keep the schema. Talkform owns the interview, extraction, and export.
            </p>
          </div>
        </div>
        <div className={styles.threeUp}>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>1</span>
            <h3>Define the fields</h3>
            <p>Describe variables, prompt copy, options, and validation in your config.</p>
          </article>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>2</span>
            <h3>Run the interview</h3>
            <p>Talkform asks one question at a time over live audio and writes the form.</p>
          </article>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>3</span>
            <h3>Export the result</h3>
            <p>Download JSON, pull through the HTTP API, CLI, or MCP server.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>The <em>surface</em></h2>
            <p className={styles.sectionIntro}>
              Transcript on the left, live question flow in the middle, captured answers on the right.
            </p>
          </div>
        </div>
        <article className={styles.previewCard}>
          <div className={styles.previewStage}>
            <div className={styles.previewPanel}>
              <div className={styles.eyebrow}>Transcript</div>
              <div className={styles.previewTranscriptLine}></div>
              <div className={styles.previewTranscriptLine}></div>
              <div className={styles.previewTranscriptLine}></div>
              <div className={styles.previewTranscriptLine}></div>
            </div>
            <div className={styles.previewCenter}>
              <div className={styles.eyebrow}>Prompt canvas</div>
              <div className={styles.previewHeroTitle}>Lock the learner identity</div>
              <div className={styles.previewHeroBody}>
                Ask for the person&apos;s name first, confirm it, and keep the interview moving one question at a time.
              </div>
              <div className={styles.previewChipRow}>
                <span className={styles.previewChip}>Name</span>
                <span className={styles.previewChip}>Role</span>
                <span className={styles.previewChip}>Goals</span>
                <span className={styles.previewChip}>AI comfort</span>
              </div>
            </div>
            <div className={styles.previewPanel}>
              <div className={styles.eyebrow}>Form answers</div>
              <div className={styles.previewFormLine}></div>
              <div className={styles.previewFormLine}></div>
              <div className={styles.previewFormLine}></div>
              <div className={styles.previewFormLine}></div>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}><em>Integrations</em></h2>
            <p className={styles.sectionIntro}>
              Use Talkform from a product UI, backend, terminal, or agent runtime.
            </p>
          </div>
        </div>
        <div className={styles.fourUp}>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>R</div>
            <h3>React</h3>
            <p>Embed the widget in any React product.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>API</div>
            <h3>HTTP API</h3>
            <p>Bootstrap sessions and pull exports.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>CLI</div>
            <h3>CLI</h3>
            <p>Generate configs and export results.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>MCP</div>
            <h3>MCP</h3>
            <p>Expose to coding agents.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>Canonical <em>result</em></h2>
            <p className={styles.sectionIntro}>
              One stable schema so downstream systems can adapt it into plans, CRM records, or onboarding flows.
            </p>
          </div>
        </div>
        <article className={styles.outputCard}>
          <h3>AudioformSessionResult</h3>
          <p>Same shape across UI, HTTP API, CLI, and MCP.</p>
          <pre className={styles.jsonBlock}>{JSON.stringify(sampleResult, null, 2)}</pre>
        </article>
        <article className={styles.outputCard}>
          <h3>Schema availability</h3>
          <p>Published at <code>/schemas/audioform-session-result.json</code></p>
          <pre className={styles.jsonBlock}>{JSON.stringify(audioformSessionResultJsonSchema, null, 2)}</pre>
        </article>
      </section>
    </main>
  );
}
