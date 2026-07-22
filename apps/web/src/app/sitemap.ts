import type { MetadataRoute } from "next";
import { docsIndex } from "@/lib/docs";
import { getAllBlogPosts, getAllTags, normalizeTag } from "@/lib/blog";
import { providerImports, useCases } from "@/lib/content";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes = [
  "", "/about", "/accessibility", "/blog", "/changelog", "/contact", "/cookies", "/docs",
  "/embed", "/evidence/agent-readiness", "/faq", "/feed.xml", "/import", "/pricing", "/privacy", "/security", "/status",
  "/subprocessors", "/terms", "/use-cases",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllBlogPosts();
  const latestUpdate = posts.reduce((latest, post) => post.updatedAt > latest ? post.updatedAt : latest, "2026-07-12");
  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(route || "/"),
  }));

  entries.push(
    ...docsIndex.map((doc) => ({ url: absoluteUrl(`/docs/${doc.slug}`) })),
    ...posts.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: new Date(`${post.updatedAt}T12:00:00Z`) })),
    ...getAllTags().map((tag) => ({ url: absoluteUrl(`/blog/tag/${normalizeTag(tag)}`), lastModified: new Date(`${latestUpdate}T12:00:00Z`) })),
    ...useCases.map((entry) => ({ url: absoluteUrl(`/use-cases/${entry.slug}`) })),
    ...providerImports.map((entry) => ({ url: absoluteUrl(`/import/${entry.slug}`) })),
  );

  return entries;
}
