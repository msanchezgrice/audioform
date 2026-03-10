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
        <div className={styles.docList}>
          {docsIndex.map((doc, index) => (
            <article key={doc.slug} className={styles.docRow}>
              <div className={styles.docRowIndex}>{String(index + 1).padStart(2, "0")}</div>
              <div className={styles.docRowBody}>
                <div className={styles.eyebrow}>Guide</div>
                <h3>{doc.title}</h3>
                <p>{doc.description}</p>
              </div>
              <Link href={`/docs/${doc.slug}`} className={styles.docLink}>
                Open
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
