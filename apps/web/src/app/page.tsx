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
          <h1>Turn any form into a live audio interview.</h1>
          <p className={styles.lede}>
            Talkform asks questions out loud, fills structured variables directly from the conversation,
            and exports product-friendly JSON for apps, workflows, and AI agents.
          </p>
          <div className={styles.heroActions}>
            <Link href="/app" className={styles.primaryAction}>
              Try the demo
            </Link>
            <Link href="/docs" className={styles.secondaryAction}>
              Read docs
            </Link>
            <Link href="/docs/agents" className={styles.ghostAction}>
              Use with agents
            </Link>
          </div>
        </article>

        <div className={styles.heroAside}>
          <div className={styles.ctaCard}>
            <strong>How it works</strong>
            <p>Define fields, run the audio intake, export structured results.</p>
          </div>
          <div className={styles.surface}>
            <strong>Built for agents</strong>
            <p>MCP tools, a CLI, JSON schemas, and docs that explain exactly how to configure and consume Talkform.</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <p className={styles.sectionIntro}>
          Products keep the schema they need. Talkform owns the interview, structured extraction, and export surface.
        </p>
        <div className={styles.threeUp}>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>1</span>
            <h3>Define the fields</h3>
            <p>Describe the required variables, prompt copy, options, and validation in `AudioformConfig`.</p>
          </article>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>2</span>
            <h3>Run the audio intake</h3>
            <p>Talkform asks one question at a time over live audio and updates the structured form directly.</p>
          </article>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>3</span>
            <h3>Export the result</h3>
            <p>Download JSON or markdown exports, or pull the same data through the HTTP API, CLI, or MCP server.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The product surface</h2>
        <p className={styles.sectionIntro}>
          Your answers on the left, the live question flow in the middle, and captured form answers on the right.
        </p>
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
                Ask for the person’s name first, confirm it, and keep the interview moving one question at a time.
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
        <h2 className={styles.sectionTitle}>Integrations</h2>
        <p className={styles.sectionIntro}>
          Use Talkform from a product UI, a backend, the terminal, or an agent runtime.
        </p>
        <div className={styles.fourUp}>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>React</div>
            <h3>Embed the widget</h3>
            <p>Use `@talkform/react` to drop the full audio form experience into a React product.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>HTTP API</div>
            <h3>Create and export sessions</h3>
            <p>Bootstrap sessions, validate configs, and pull exports over simple JSON endpoints.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>CLI</div>
            <h3>Scaffold and validate</h3>
            <p>Generate starter configs, run the demo locally, and export results from the command line.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>MCP</div>
            <h3>Make it agent-usable</h3>
            <p>Expose templates, schemas, validation, session creation, and exports to coding agents.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Agent quickstart</h2>
        <p className={styles.sectionIntro}>
          Agents can discover Talkform from `llms.txt`, create configs, validate them, and consume session results.
        </p>
        <div className={styles.docGrid}>
          <article className={styles.docCard}>
            <div className={styles.eyebrow}>CLI</div>
            <h3>`audioform validate ./customer-intake.json`</h3>
            <p>Validate a form definition before any product wiring happens.</p>
          </article>
          <article className={styles.docCard}>
            <div className={styles.eyebrow}>MCP</div>
            <h3>`audioform.create_session`</h3>
            <p>Launch a browser-driven intake session and then fetch it back through MCP or HTTP export endpoints.</p>
          </article>
          <article className={styles.docCard}>
            <div className={styles.eyebrow}>JSON</div>
            <h3>Canonical export</h3>
            <p>The same `AudioformSessionResult` shape is used by the UI, HTTP API, CLI, and MCP server.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Canonical output</h2>
        <p className={styles.sectionIntro}>
          Talkform exports one stable result schema so downstream products can adapt it into plans, CRM records, or onboarding flows.
        </p>
        <article className={styles.outputCard}>
          <h3>AudioformSessionResult</h3>
          <p>The hosted app also publishes the JSON schemas at `/schemas/audioform-config.json` and `/schemas/audioform-session-result.json`.</p>
          <pre className={styles.jsonBlock}>{JSON.stringify(sampleResult, null, 2)}</pre>
        </article>
        <article className={styles.outputCard}>
          <h3>Schema availability</h3>
          <pre className={styles.jsonBlock}>{JSON.stringify(audioformSessionResultJsonSchema, null, 2)}</pre>
        </article>
      </section>
    </main>
  );
}
