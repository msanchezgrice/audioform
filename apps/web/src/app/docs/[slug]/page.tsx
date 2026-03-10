import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "../../site.module.css";
import { getDocContent } from "@/lib/docs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocContent(slug);
  if (!doc) {
    return {};
  }

  return {
    title: doc.title,
    description: doc.description,
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getDocContent(slug);

  if (!doc) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <section className={styles.section}>
        <div className={styles.eyebrow}>Docs</div>
        <h1 className={styles.sectionTitle}>{doc.title}</h1>
        <p className={styles.sectionIntro}>{doc.description}</p>
        <article className={styles.markdown}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
        </article>
      </section>
    </main>
  );
}

