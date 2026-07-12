import Link from "next/link";
import styles from "../content.module.css";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.hero}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </header>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.cardGrid}>{children}</div>;
}

export function ContentCard({
  href,
  eyebrow,
  title,
  description,
  meta,
}: {
  href: string;
  eyebrow?: string;
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <article className={styles.card}>
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <h2><Link href={href}>{title}</Link></h2>
      <p>{description}</p>
      {meta ? <small>{meta}</small> : null}
      <Link href={href} className={styles.textLink}>Read more <span aria-hidden="true">→</span></Link>
    </article>
  );
}

export function TagLinks({ tags }: { tags: string[] }) {
  return (
    <div className={styles.tags} aria-label="Article tags">
      {tags.map((tag) => (
        <Link key={tag} href={`/blog/tag/${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
          {tag}
        </Link>
      ))}
    </div>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <article className={styles.prose}>{children}</article>;
}

export function PrimaryCta() {
  return (
    <aside className={styles.ctaBand}>
      <div>
        <h2>Test a guided interview</h2>
        <p>Try the browser demo or import a public form into an editable draft.</p>
      </div>
      <div className={styles.actions}>
        <Link href="/app" className={styles.primaryButton}>Try the demo</Link>
        <Link href="/import" className={styles.secondaryButton}>Import a form</Link>
      </div>
    </aside>
  );
}

export function PolicyPage({
  eyebrow,
  title,
  description,
  updated = "July 12, 2026",
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  updated?: string;
  sections: Array<{ title: string; content: React.ReactNode }>;
}) {
  return (
    <main className={styles.page}>
      <PageHero eyebrow={eyebrow} title={title} description={description}>
        <p>Last updated {updated}</p>
      </PageHero>
      <Prose>
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.content}
          </section>
        ))}
      </Prose>
    </main>
  );
}
