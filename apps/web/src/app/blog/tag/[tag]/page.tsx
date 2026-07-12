import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardGrid, ContentCard, PageHero } from "../../../_components/content";
import { getAllTags, getPostsByTag, normalizeTag } from "@/lib/blog";
import { createMetadata } from "@/lib/seo";
import styles from "../../../content.module.css";

export function generateStaticParams() {
  return getAllTags().map((tag) => ({ tag: normalizeTag(tag) }));
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  const label = getAllTags().find((entry) => normalizeTag(entry) === tag);
  if (!label) return {};
  return createMetadata({
    title: `${label} articles`,
    description: `Talkform guides about ${label}, with practical examples and links to authoritative sources.`,
    path: `/blog/tag/${tag}`,
  });
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const label = getAllTags().find((entry) => normalizeTag(entry) === tag);
  const posts = getPostsByTag(tag);
  if (!label || posts.length === 0) notFound();
  return (
    <main className={styles.page}>
      <PageHero eyebrow="Blog tag" title={label} description={`Referenced Talkform guides filed under ${label}.`} />
      <CardGrid>
        {posts.map((post) => (
          <ContentCard key={post.slug} href={`/blog/${post.slug}`} title={post.title} description={post.description} eyebrow={post.tags.join(" · ")} />
        ))}
      </CardGrid>
    </main>
  );
}
