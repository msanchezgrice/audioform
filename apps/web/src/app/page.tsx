import Link from "next/link";
import { audioformSessionResultJsonSchema } from "@talkform/core";
import { JsonLd } from "./_components/content";
import styles from "./site.module.css";

const homeFaqs = [
  { question: "What does Talkform do today?", answer: "Talkform can turn supported fields from a public form URL into an editable draft, run a guided browser voice or text interview, and export structured JSON." },
  { question: "Is microphone access required?", answer: "No. Typing is available without a realtime audio connection and stays in your browser until export. A text-only deployment never requests microphone permission." },
  { question: "Which form providers can Talkform import?", answer: "The importer recognizes common patterns from Typeform, Google Forms, Jotform, and HubSpot public forms. Complex logic, uploads, payments, widgets, restricted forms, and provider automation may require manual work." },
  { question: "How much does Talkform cost?", answer: "Public pricing is not yet published. You can try the browser demo and public-form importer today; plan limits will be published before self-serve charging begins." },
];

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
    model: "gpt-realtime-2.1",
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
          <p className={styles.answerBlock}>
            Talkform converts online forms into guided voice interviews. You import a public form or define its
            fields, Talkform asks each question aloud in the browser, writes the answers into structured fields,
            and exports the results as clean JSON. It imports Typeform, Google Forms, Jotform, and HubSpot forms,
            and the browser demo is free to try.
          </p>
          <p className={styles.lede}>
            Talkform asks questions aloud, fills structured fields from the conversation,
            and exports clean JSON for your apps, workflows, and agents.
          </p>
          <div className={styles.heroActions}>
            <Link href="/app" className={styles.primaryAction} data-agent-action="try-demo" data-testid="cta-try-demo">
              Try the demo
            </Link>
            <Link href="/import" className={styles.secondaryAction} data-agent-action="import-form" data-testid="cta-import-form">
              Import a form
            </Link>
            <Link href="/docs" className={styles.ghostAction} data-testid="cta-read-docs">
              Read docs
            </Link>
          </div>
        </article>

        <div className={styles.heroAside}>
          <div className={styles.ctaCard}>
            <strong>Import existing forms</strong>
            <p>Paste a public URL from Typeform, Google Forms, Jotform, or HubSpot, then review an editable draft before testing the interview.</p>
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
              Import your existing form and compare a guided conversational path with the current experience.
            </p>
          </div>
        </div>

        <table className={styles.compareTable}>
          <caption className={styles.visuallyHidden}>
            Comparison of a static form against a guided Talkform audio interview
          </caption>
          <thead>
            <tr>
              <th scope="col"><span className={styles.visuallyHidden}>Dimension</span></th>
              <th scope="col" className={styles.compareOldCol}>
                <span className={styles.eyebrow}>Old way</span>
                <span className={styles.compareHeadline}>Static forms demand attention every screen</span>
              </th>
              <th scope="col" className={styles.compareNewCol}>
                <span className={styles.eyebrow}>New way</span>
                <span className={styles.compareHeadline}>Talkform carries the interview and writes the answers</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Steps</th>
              <td>Open, read, scan, type, submit</td>
              <td>Open, answer aloud, review draft</td>
            </tr>
            <tr>
              <th scope="row">Duration</th>
              <td>Respondent reads and types each answer</td>
              <td>Evaluate in a controlled pilot</td>
            </tr>
            <tr>
              <th scope="row">Completion</th>
              <td>Use as the measured baseline</td>
              <td>Compare in an A/B test</td>
            </tr>
          </tbody>
        </table>
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
            <p>Download JSON locally, or use a configured HTTP API and CLI deployment.</p>
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
            <p>Expose schemas and templates to coding agents.</p>
          </article>
        </div>
        <article className={styles.outputCard}>
          <h3>Hosted API boundary</h3>
          <p>
            Transient session APIs and public Realtime issuance are disabled in hosted production by default.
            Enable them only after adding a durable session store, a distributed rate limiter, and server authentication;
            the checked-in process-local implementations are for development and controlled evaluation.
          </p>
        </article>
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
          <p>One schema across the UI, HTTP API, CLI, and MCP resources.</p>
          <pre className={styles.jsonBlock}>{JSON.stringify(sampleResult, null, 2)}</pre>
        </article>
        <article className={styles.outputCard}>
          <h3>Schema availability</h3>
          <p>Published at <code>/schemas/audioform-session-result.json</code></p>
          <pre className={styles.jsonBlock}>{JSON.stringify(audioformSessionResultJsonSchema, null, 2)}</pre>
        </article>
      </section>

      <section className={styles.section} aria-labelledby="home-faq-heading">
        <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: homeFaqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }} />
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle} id="home-faq-heading">Quick <em>answers</em></h2>
            <p className={styles.sectionIntro}>
              The questions people ask first. The full list lives on the <Link href="/faq">FAQ page</Link>.
            </p>
          </div>
        </div>
        <div className={styles.faqList}>
          {homeFaqs.map((faq) => (
            <article key={faq.question} className={styles.faqItem}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
