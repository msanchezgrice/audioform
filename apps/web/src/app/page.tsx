import Link from "next/link";
import { JsonLd } from "./_components/content";
import { LiveDemoShowcase } from "@/components/live-demo-showcase";
import { MarketingVideo } from "@/components/marketing-video";
import styles from "./site.module.css";

const homeFaqs = [
  { question: "What does Talkform do today?", answer: "Talkform gives AI agents a hosted handoff: register a workspace, ask a person to answer a focused text form, and retrieve reviewed JSON. Human-owned workspaces can optionally use capped voice; the public importer and demo remain available." },
  { question: "Is microphone access required?", answer: "No. In the public demo, typing is available without a realtime audio connection and stays in your browser until export. A text-only hosted handoff never requests microphone permission." },
  { question: "Which form providers can Talkform import?", answer: "The importer recognizes common patterns from Typeform, Google Forms, Jotform, and HubSpot public forms. Complex logic, uploads, payments, widgets, restricted forms, and provider automation may require manual work." },
  { question: "How much does Talkform cost?", answer: "Core text handoffs are free. Machine workspaces start with 10 per day; an optional human claim enables up to 100 per day per project. Capped voice is available only after that claim. Links and completed results are available for 7 days." },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <article className={styles.heroCard}>
          <div className={styles.heroKicker}>Human input for AI agents</div>
          <h1>Your agent asks. A human answers. Get reviewed JSON.</h1>
          <p className={styles.lede}>
            Give an agent a dependable handoff when the next step needs a person. Talkform
            hosts a focused form, guides the response by text, and returns
            structured answers after the person reviews them.
          </p>
          <div className={styles.heroActions}>
            <Link href="/docs/getting-started" className={styles.primaryAction} data-agent-action="get-started-free" data-testid="cta-get-started-free">
              Get started free
            </Link>
            <Link href="/dashboard" className={styles.secondaryAction} data-agent-action="open-human-workspace">
              Open dashboard
            </Link>
            <Link href="/app" className={styles.secondaryAction} data-agent-action="try-demo" data-testid="cta-try-demo">
              Try the demo
            </Link>
            <Link href="/import" className={styles.ghostAction} data-agent-action="import-form" data-testid="cta-import-form">
              Import a form
            </Link>
            <Link href="/docs" className={styles.ghostAction} data-testid="cta-read-docs">
              Read docs
            </Link>
          </div>
        </article>

        <aside className={styles.setupPanel} aria-labelledby="setup-heading">
          <div className={styles.setupHeader}>
            <span className={styles.setupKicker}>The handoff loop</span>
            <h2 id="setup-heading">From a request to a result</h2>
          </div>
          <ol className={styles.setupSteps}>
            <li>
              <span className={styles.setupMarker}>01</span>
              <div><strong>Register an agent</strong><p>Give your agent a place to keep its forms and handoffs.</p></div>
            </li>
            <li>
              <span className={styles.setupMarker}>02</span>
              <div><strong>Create a handoff</strong><p>Describe the fields your agent needs a person to answer.</p></div>
            </li>
            <li>
              <span className={styles.setupMarker}>03</span>
              <div><strong>Share one private link</strong><p>The respondent answers, reviews the fields, and submits.</p></div>
            </li>
            <li>
              <span className={styles.setupMarker}>04</span>
              <div><strong>Receive reviewed JSON</strong><p>Receive a completion event or poll, then retrieve the reviewed result.</p></div>
            </li>
          </ol>
          <p className={styles.setupNote}>Free text forms. Optional voice is available in verified workspaces and remains capped under shared limits.</p>
          <div className={styles.agentInstructions}>
            <span>For agents</span>
            <code>https://www.talkform.ai/agents.md</code>
            <Link href="/agents.md">Open agent instructions <span aria-hidden="true">→</span></Link>
          </div>
        </aside>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <div className={styles.eyebrow}>Try it live</div>
            <h2 className={styles.sectionTitle}>Pick a use case. Hear the <em>interview</em>.</h2>
            <p className={styles.sectionIntro}>
              Every example below is a real Talkform config. Answer one question and watch it land
              as structured JSON — the same result your app, workflow, or agent receives.
            </p>
          </div>
        </div>
        <LiveDemoShowcase
          vendorUrl={process.env.NEXT_PUBLIC_AUDIOFORM_VENDOR_URL ?? ""}
          voiceEnabled={process.env.TALKFORM_ENABLE_PUBLIC_REALTIME === "true"}
        />
      </section>

      <section className={`${styles.section} ${styles.homeDemo}`}>
        <MarketingVideo
          videoId="talkform-demo-home"
          eyebrow="38-second product story"
          title="See the form become a conversation"
          description="A quick look at the problem, the guided interview, and the structured result Talkform sends downstream."
          src="/videos/talkform-demo.mp4"
          poster="/videos/talkform-demo-poster.jpg"
          captions="/videos/talkform-demo.vtt"
        />
        <Link href="/use-cases" className={styles.demoLink}>Explore feedback, onboarding, and personalization <span aria-hidden="true">→</span></Link>
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
              <td>Answer, review, and continue</td>
            </tr>
            <tr>
              <th scope="row">Completion</th>
              <td>Use as the measured baseline</td>
              <td>Measure what people complete</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>How a handoff works</h2>
            <p className={styles.sectionIntro}>
              Your agent keeps the workflow. Talkform handles the focused questions, review, and structured result.
            </p>
          </div>
        </div>
        <div className={styles.threeUp}>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>1</span>
            <h3>Register and describe</h3>
            <p>Give your agent a workspace, then describe the fields a person needs to answer.</p>
          </article>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>2</span>
            <h3>Share one link</h3>
            <p>Send a private link. The respondent answers by text, reviews each field, and submits.</p>
          </article>
          <article className={styles.stepCard}>
            <span className={styles.stepNumber}>3</span>
            <h3>Continue with JSON</h3>
            <p>Poll or receive a signed completion event, then fetch the reviewed structured result.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>The <em>surface</em></h2>
            <p className={styles.sectionIntro}>
            A focused question flow in the middle, with the reviewed fields your agent receives on the right.
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
            <p>Embed a focused text or voice handoff in your product.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>API</div>
            <h3>HTTP API</h3>
            <p>Register an agent, create links, and retrieve reviewed JSON.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>CLI</div>
            <h3>CLI</h3>
            <p>Run a complete handoff workflow from a trusted worker.</p>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.eyebrow}>MCP</div>
            <h3>MCP</h3>
            <p>Register an agent or create handoffs from an MCP client.</p>
          </article>
        </div>
        <article className={styles.outputCard}>
          <h3>Built for a bounded handoff</h3>
          <p>
            Machine workspaces start with 10 hosted text handoffs per day. An optional human claim enables up to 100 text handoffs per day per project and capped voice under shared limits.
            Respondent links and completed results remain available for 7 days. Configure signed completion events or poll from your worker.
          </p>
          <p className={styles.sectionIntro}>The free core is text-first, with no production SLA promise.</p>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>One result contract</h2>
            <p className={styles.sectionIntro}>
              A reviewed response arrives as structured JSON that your agent can validate and route.
            </p>
          </div>
        </div>
        <article className={styles.outputCard}>
          <h3>AudioformSessionResult</h3>
          <p>One result shape across the HTTP API, CLI, and MCP tools: reviewed fields, completion status, and response mode.</p>
          <div className={styles.resultRows}>
            <div><span>Status</span><strong>completed</strong></div>
            <div><span>Fields</span><strong>reviewed structured values</strong></div>
            <div><span>Transcript</span><strong>not retained by hosted handoffs</strong></div>
            <div><span>Summary</span><strong>empty for hosted handoffs</strong></div>
          </div>
        </article>
        <article className={styles.outputCard}>
          <h3>Read the schema</h3>
          <p>Use the published schema when you validate or map the result in your own system.</p>
          <p><Link href="/schemas/audioform-session-result.json" className={styles.docLink}>Open AudioformSessionResult schema</Link></p>
        </article>
      </section>

      <section className={styles.section} aria-labelledby="home-faq-heading">
        <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: homeFaqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }} />
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle} id="home-faq-heading">Quick <em>answers</em></h2>
          <p className={styles.sectionIntro}>Start with the <Link href="/faq">FAQ</Link> for agent registration, handoffs, voice, and data boundaries.</p>
          </div>
        </div>
        <p className={styles.answerBlock}>
          The public demo keeps transcript, summary, and answers in the browser until export. Hosted handoffs
          store reviewed structured fields for the published access window, then return JSON to the owning project.
          A respondent always reviews and explicitly submits before a hosted result is available.
        </p>
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
