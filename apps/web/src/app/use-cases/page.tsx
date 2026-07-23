import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../_components/content";
import { MarketingVideo } from "@/components/marketing-video";
import { useCases } from "@/lib/content";
import { absoluteUrl, createMetadata } from "@/lib/seo";
import styles from "./use-cases.module.css";

export const metadata: Metadata = createMetadata({
  title: "Talkform use cases | Feedback, onboarding, and personalization",
  description: "Replace rigid forms with guided voice interviews that collect richer context and return reviewed, structured data for the tools you already use.",
  path: "/use-cases",
});

const primaryUseCases = [
  {
    slug: "customer-feedback",
    number: "01",
    label: "Customer feedback",
    title: "Hear the reason behind the rating.",
    description: "Start with the score, then follow the thread. Talkform captures the story, the friction, and a concrete next step without asking the customer to type an essay.",
    prompt: "What made setup harder than you expected?",
    output: "Friction: unclear permissions · Severity: high · Follow-up: yes",
  },
  {
    slug: "customer-onboarding",
    number: "02",
    label: "Onboarding",
    title: "Start with context, not a checklist.",
    description: "Collect goals, stakeholders, constraints, and timelines before kickoff. Your team gets a usable brief; the customer gets a guided conversation.",
    prompt: "What would make the first 30 days a win?",
    output: "Goal: launch pilot · Team: 6 · Deadline: September",
  },
  {
    slug: "product-personalization",
    number: "03",
    label: "Product personalization",
    title: "Adapt to what people actually mean.",
    description: "Let customers explain what they are trying to do. Turn their language into reviewed preferences your product can use to shape the next screen, plan, or recommendation.",
    prompt: "Tell me what you want to accomplish this week.",
    output: "Intent: publish launch · Experience: first-time · Pace: guided",
  },
] as const;

const primarySlugs = new Set(primaryUseCases.map((entry) => entry.slug));
const additionalUseCases = useCases.filter((entry) => !primarySlugs.has(entry.slug as (typeof primaryUseCases)[number]["slug"]));

export default function UseCasesPage() {
  return (
    <main className={styles.page}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Talkform use cases",
        url: absoluteUrl("/use-cases"),
        hasPart: useCases.map((entry) => ({ "@type": "WebPage", name: entry.title, url: absoluteUrl(`/use-cases/${entry.slug}`) })),
      }} />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>From form fields to real answers</span>
          <h1>People have more to say than your form knows to ask.</h1>
          <p>
            Talkform replaces rigid fields with a guided voice interview, asks for the missing context,
            and returns reviewed, structured data for the workflow you already use.
          </p>
          <div className={styles.actions}>
            <Link href="/app" className={styles.primaryButton}>Try a conversation</Link>
            <Link href="/import" className={styles.secondaryButton}>Import a form</Link>
          </div>
        </div>

        <aside className={styles.benchmark} aria-label="Form completion benchmark">
          <span className={styles.benchmarkLabel}>The form friction problem</span>
          <strong>About half</strong>
          <p>of form starters fail to submit in a 93,022,997-session benchmark.</p>
          <div className={styles.benchmarkBars} aria-hidden="true">
            <span style={{ "--bar": "55.5%" } as React.CSSProperties}>Desktop <b>55.5% complete</b></span>
            <span style={{ "--bar": "47.5%" } as React.CSSProperties}>Mobile <b>47.5% complete</b></span>
          </div>
          <small>
            Source: <a href="https://www.zuko.io/benchmarking/industry-benchmarking">Zuko Form Abandonment Data by Industry Sector, 2025</a>. Results vary by form, audience, and device.
          </small>
        </aside>
      </section>

      <section className={styles.demoSection}>
        <MarketingVideo
          videoId="talkform-demo"
          eyebrow="38-second product story"
          title="A conversation in. Structured data out."
          description="See how Talkform moves from a natural answer to a complete, reviewable result without losing the schema your systems expect."
          src="/videos/talkform-demo.mp4"
          poster="/videos/talkform-demo-poster.jpg"
          captions="/videos/talkform-demo.vtt"
        />
      </section>

      <section className={styles.thesis}>
        <div>
          <span className={styles.eyebrow}>The shift</span>
          <h2>A form records the answer it asked for. A conversation can find the answer you needed.</h2>
        </div>
        <div className={styles.flow} aria-label="Talkform data flow">
          <article><span>1</span><strong>Listen</strong><p>Let someone explain it naturally.</p></article>
          <i aria-hidden="true">→</i>
          <article><span>2</span><strong>Clarify</strong><p>Ask only for what is missing.</p></article>
          <i aria-hidden="true">→</i>
          <article><span>3</span><strong>Structure</strong><p>Review clean fields and JSON.</p></article>
        </div>
      </section>

      <section className={styles.primarySection}>
        <header className={styles.sectionHeader}>
          <span className={styles.eyebrow}>Start where context matters most</span>
          <h2>Three high-leverage ways to use Talkform</h2>
        </header>
        <div className={styles.primaryGrid}>
          {primaryUseCases.map((entry) => (
            <article className={styles.primaryCard} key={entry.slug}>
              <div className={styles.cardTopline}><span>{entry.number}</span><b>{entry.label}</b></div>
              <h3>{entry.title}</h3>
              <p>{entry.description}</p>
              <div className={styles.miniInterview}>
                <span className={styles.miniPrompt}>{entry.prompt}</span>
                <span className={styles.waveform} aria-label="Spoken response waveform">▂▅▃▇▆▂▃▆▇▃▅▂</span>
                <span className={styles.miniOutput}>{entry.output}</span>
              </div>
              <Link href={`/use-cases/${entry.slug}`}>Explore the workflow <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.integrationBand}>
        <div>
          <span className={styles.eyebrow}>Keep the stack you already have</span>
          <h2>Talk naturally. Integrate structurally.</h2>
          <p>Embed with React, create and export sessions over HTTP, work from the CLI, or expose schemas and templates through MCP.</p>
          <Link href="/docs">See integration docs <span aria-hidden="true">→</span></Link>
        </div>
        <pre aria-label="Example structured Talkform output"><code>{`{
  "goal": "launch a pilot",
  "constraint": "six-person team",
  "urgency": "this quarter",
  "followUp": true
}`}</code></pre>
      </section>


      <section className={styles.additionalSection}>
        <header className={styles.sectionHeader}>
          <span className={styles.eyebrow}>More workflows</span>
          <h2>Anywhere the open-ended answer matters</h2>
        </header>
        <div className={styles.additionalGrid}>
          {additionalUseCases.map((entry) => (
            <article key={entry.slug}>
              <span>{entry.audience}</span>
              <h3><Link href={`/use-cases/${entry.slug}`}>{entry.title}</Link></h3>
              <p>{entry.description}</p>
              <Link href={`/use-cases/${entry.slug}`}>View use case <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.eyebrow}>The next form can be a conversation</span>
        <h2>Give people room to answer. Keep the data structured.</h2>
        <div className={styles.actions}>
          <Link href="/app" className={styles.primaryButton}>Try Talkform</Link>
          <Link href="/import" className={styles.secondaryButton}>Import your current form</Link>
        </div>
      </section>
    </main>
  );
}
