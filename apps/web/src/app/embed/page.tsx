import type { Metadata } from "next";
import Link from "next/link";
import styles from "./embed.module.css";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "React integration",
  description:
    "Use Talkform's current React widget integration and follow hosted embed availability.",
  path: "/embed",
});

export default function EmbedPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>Self-hosted React widget</div>
        <h1>
          Add Talkform to a <em>React product</em>
        </h1>
        <p className={styles.lede}>
          The current integration path is the typed React component in the Talkform
          source repository; it is not yet a published npm package. Hosted iframe and script embeds are coming soon.
        </p>
        <div className={styles.heroActions}>
          <Link href="/app" className={styles.primaryAction}>
            Try the demo
          </Link>
          <Link href="/docs" className={styles.secondaryAction}>
            Read docs
          </Link>
        </div>
      </section>

      <section className={styles.preview}>
        <div className={styles.previewFrame}>
          <div className={styles.previewBar}>
            <span className={styles.dot} />
            <span className={styles.dotOlive} />
            <span className={styles.dotMuted} />
            <span className={styles.previewLabel}>Consumer widget preview</span>
          </div>

          <div className={styles.widgetMock}>
            <div className={styles.widgetHeader}>
              <div className={styles.widgetBrand}>
                <span className={styles.brandCircle}>tf</span>
                Talkform
              </div>
            </div>

            <div className={styles.widgetBody}>
              <div className={styles.widgetPrompt}>
                <h3>What should I call you?</h3>
                <p>
                  The host is asking for your name to personalize the
                  conversation.
                </p>
              </div>

              <div className={styles.widgetWave}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className={styles.waveBar}
                    style={
                      {
                        "--delay": `${i * 60}ms`,
                        "--h": `${20 + Math.sin(i * 0.6) * 15}px`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              <div className={styles.widgetChips}>
                <span className={styles.chipDone}>Name</span>
                <span className={styles.chipActive}>Role</span>
                <span className={styles.chipPending}>Goals</span>
                <span className={styles.chipPending}>AI comfort</span>
              </div>
            </div>

            <div className={styles.widgetFooter}>
              <button
                type="button"
                className={styles.micButton}
                aria-label="Microphone preview (not interactive)"
                disabled
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="1" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>
              <span className={styles.footerHint}>Preview only — try the live demo to interact</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            Available <em>in source</em>
          </h2>
          <p>Use the workspace package with your Talkform configuration and API routes.</p>
        </div>

        <div className={styles.methodGrid}>
          <article className={styles.methodCard}>
            <span className={styles.methodTag}>Source repository</span>
            <h3>React component</h3>
            <p>
              Inside the Talkform workspace, import the widget from <code>@talkform/react</code>
              and pass your config plus the base path for your API routes.
            </p>
            <pre className={styles.codeBlock}>
{`import { AudioformWidget }
  from '@talkform/react';

<AudioformWidget
  config={myConfig}
  apiBasePath="/api"
/>`}
            </pre>
          </article>
        </div>
        <p className={styles.availabilityNote}>
          Hosted iframe and script embeds are coming soon. Until those endpoints ship, use the React path above or the live demo.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            What the widget <em>supports</em>
          </h2>
          <p>
            Capabilities shown here are available in the current implementation.
          </p>
        </div>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <strong>Voice or local typing</strong>
            <p>Users choose microphone-based Realtime voice or a browser-local text interview.</p>
          </div>
          <div className={styles.featureCard}>
            <strong>Inline variable capture</strong>
            <p>
              Users see pills fill in as the conversation captures each field —
              progress without friction.
            </p>
          </div>
          <div className={styles.featureCard}>
            <strong>Review and correction</strong>
            <p>
              Text, email, URL, long-answer, rating, and selection fields can be corrected before export.
            </p>
          </div>
          <div className={styles.featureCard}>
            <strong>Local exports</strong>
            <p>
              Download the current structured result as JSON or Markdown after reviewing it.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.ctaBand}>
        <h2>
          Ready to evaluate Talkform in <em>your product</em>?
        </h2>
        <div className={styles.heroActions}>
          <Link href="/docs" className={styles.primaryAction}>
            Read the docs
          </Link>
          <Link href="/app" className={styles.secondaryAction}>
            Try a live demo
          </Link>
        </div>
      </section>
    </main>
  );
}
