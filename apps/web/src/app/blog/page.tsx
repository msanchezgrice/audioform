import type { Metadata } from "next";
import { CardGrid, ContentCard, JsonLd, PageHero, TagLinks } from "../_components/content";
import { getAllBlogPosts, getAllTags } from "@/lib/blog";
import { absoluteUrl, createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({
  title: "Talkform blog",
  description: "Practical, referenced guides to voice forms, form migration, accessibility, privacy, user research, and OpenAI Realtime architecture.",
  path: "/blog",
});

export default function BlogPage() {
  const posts = getAllBlogPosts();
  return (
    <main className={styles.page}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Talkform blog",
        url: absoluteUrl("/blog"),
        blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: absoluteUrl(`/blog/${post.slug}`) })),
      }} />
      <PageHero
        eyebrow="Research-backed guides"
        title="The Talkform blog"
        description="Long-form, source-linked guides for teams building careful conversational forms. Every article includes dates, tags, related reading, and primary references."
      >
        <TagLinks tags={getAllTags()} />
      </PageHero>
      <CardGrid>
        {posts.map((post) => (
          <ContentCard
            key={post.slug}
            href={`/blog/${post.slug}`}
            eyebrow={post.tags.join(" · ")}
            title={post.title}
            description={post.description}
            meta={`Published ${post.publishedAt} · Updated ${post.updatedAt}`}
          />
        ))}
      </CardGrid>
    </main>
  );
}
