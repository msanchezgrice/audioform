import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CardGrid, ContentCard, JsonLd, PageHero, Prose, TagLinks } from "../../_components/content";
import { getAllBlogPosts, getBlogPost, getBlogPostSummary, getRelatedPosts } from "@/lib/blog";
import { absoluteUrl, createMetadata, SITE_NAME } from "@/lib/seo";
import styles from "../../content.module.css";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostSummary(slug);
  if (!post) return {};
  return createMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    tags: post.tags,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const related = getRelatedPosts(post);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/about") },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
    keywords: post.tags.join(", "),
  };

  return (
    <main className={styles.page}>
      <JsonLd data={articleJsonLd} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
          { "@type": "ListItem", position: 3, name: post.title, item: absoluteUrl(`/blog/${post.slug}`) },
        ],
      }} />
      <PageHero eyebrow="Talkform guide" title={post.title} description={post.description}>
        <p><time dateTime={post.publishedAt}>Published {post.publishedAt}</time> · Updated {post.updatedAt} · {post.readingMinutes} minute read</p>
        <TagLinks tags={post.tags} />
      </PageHero>
      <Prose>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        <section aria-labelledby="references-heading">
          <h2 id="references-heading">References and further reading</h2>
          <ol>
            {post.references.map((reference) => (
              <li key={reference.url}>
                <a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>, {reference.publisher}
              </li>
            ))}
          </ol>
        </section>
      </Prose>
      <section className={styles.section}>
        <h2>Related posts</h2>
        <CardGrid>
          {related.map((entry) => (
            <ContentCard key={entry.slug} href={`/blog/${entry.slug}`} title={entry.title} description={entry.description} eyebrow={entry.tags.join(" · ")} />
          ))}
        </CardGrid>
      </section>
      <p><Link href="/blog">← All Talkform articles</Link></p>
    </main>
  );
}
