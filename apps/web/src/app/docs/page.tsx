import Link from "next/link";
import styles from "../site.module.css";
import { docsIndex } from "@/lib/docs";

export default function DocsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <div className={styles.eyebrow}>Docs</div>
        <h1 className={styles.sectionTitle}>Documentation</h1>
        <p className={styles.sectionIntro}>
          Everything needed to embed Talkform, validate configs, expose it through MCP, and onboard AI agents.
        </p>
        <div className={styles.docGrid}>
          {docsIndex.map((doc) => (
            <article key={doc.slug} className={styles.docCard}>
              <div className={styles.eyebrow}>Guide</div>
              <h3>{doc.title}</h3>
              <p>{doc.description}</p>
              <Link href={`/docs/${doc.slug}`} className={styles.docLink}>
                Open doc
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

