import fs from "node:fs/promises";
import path from "node:path";
import manifest from "@/content/blog/manifest.json";

export type BlogReference = {
  title: string;
  publisher: string;
  url: string;
};

export type BlogPostSummary = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  related: string[];
  references: BlogReference[];
};

export type BlogPost = BlogPostSummary & { content: string; readingMinutes: number };

export const blogPosts = manifest satisfies BlogPostSummary[];

function blogRoot() {
  return path.join(process.cwd(), "src/content/blog");
}

export function getAllBlogPosts(): BlogPostSummary[] {
  return [...blogPosts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getBlogPostSummary(slug: string) {
  return blogPosts.find((post) => post.slug === slug) ?? null;
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const post = getBlogPostSummary(slug);
  if (!post) return null;
  const content = await fs.readFile(path.join(blogRoot(), `${slug}.md`), "utf8");
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return { ...post, content, readingMinutes: Math.max(1, Math.ceil(wordCount / 220)) };
}

export function getAllTags() {
  return [...new Set(blogPosts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b));
}

export function normalizeTag(tag: string) {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getPostsByTag(tag: string) {
  const normalized = normalizeTag(tag);
  return getAllBlogPosts().filter((post) => post.tags.some((entry) => normalizeTag(entry) === normalized));
}

export function getRelatedPosts(post: BlogPostSummary) {
  return post.related
    .map((slug) => getBlogPostSummary(slug))
    .filter((entry): entry is BlogPostSummary => Boolean(entry));
}
