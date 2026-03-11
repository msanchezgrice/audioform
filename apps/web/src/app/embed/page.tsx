import type { Metadata } from "next";
import Link from "next/link";
import styles from "./embed.module.css";

export const metadata: Metadata = {
  title: "Embed",
  description:
    "Embed Talkform in your product with an iframe, React component, or script tag.",
};

export default function EmbedPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>Embeddable widget</div>
        <h1>
          Drop Talkform into <em>any product</em>
        </h1>
        <p className={styles.lede}>
          A single iframe, React component, or script tag gives your users a
          guided audio form — no backend changes required.
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
              <button type="button" className={styles.micButton}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="1" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>
              <span className={styles.footerHint}>Tap to speak or type below</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            Three ways to <em>embed</em>
          </h2>
          <p>Choose the integration that fits your stack.</p>
        </div>

        <div className={styles.methodGrid}>
          <article className={styles.methodCard}>
            <span className={styles.methodTag}>Easiest</span>
            <h3>Iframe</h3>
            <p>
              Point an iframe at your Talkform session URL. Works everywhere —
              Webflow, Squarespace, plain HTML.
            </p>
            <pre className={styles.codeBlock}>
{`<iframe
  src="https://talkform.ai/widget/YOUR_FORM_ID"
  width="100%" height="640"
  frameborder="0"
  allow="microphone"
></iframe>`}
            </pre>
          </article>

          <article className={styles.methodCard}>
            <span className={styles.methodTag}>React</span>
            <h3>React component</h3>
            <p>
              Import the widget from <code>@talkform/react</code> and pass your
              config object. Full TypeScript support.
            </p>
            <pre className={styles.codeBlock}>
{`import { AudioformWidget }
  from '@talkform/react';

<AudioformWidget
  config={myConfig}
  onComplete={handleResult}
/>`}
            </pre>
          </article>

          <article className={styles.methodCard}>
            <span className={styles.methodTag}>Universal</span>
            <h3>Script tag</h3>
            <p>
              A single script tag creates a global <code>Talkform</code> object.
              Call <code>Talkform.open()</code> to launch the widget.
            </p>
            <pre className={styles.codeBlock}>
{`<script src="https://cdn.talkform.ai/embed.js"
  data-form="YOUR_FORM_ID">
</script>

<script>
  Talkform.open();
</script>`}
            </pre>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            Fully <em>yours</em>
          </h2>
          <p>
            Customize colors, copy, and behavior. The widget inherits your
            brand.
          </p>
        </div>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <strong>Custom branding</strong>
            <p>Set accent colors, logo, and fonts to match your product.</p>
          </div>
          <div className={styles.featureCard}>
            <strong>Inline variable capture</strong>
            <p>
              Users see pills fill in as the conversation captures each field —
              progress without friction.
            </p>
          </div>
          <div className={styles.featureCard}>
            <strong>Completion callbacks</strong>
            <p>
              Get a structured JSON result the moment the form completes — push
              to your CRM, webhook, or agent runtime.
            </p>
          </div>
          <div className={styles.featureCard}>
            <strong>Microphone + text fallback</strong>
            <p>
              Audio-first by default, but users can always type instead if they
              prefer.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.ctaBand}>
        <h2>
          Ready to add Talkform to <em>your product</em>?
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
