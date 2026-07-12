import type { MetadataRoute } from "next";
import { docsIndex } from "@/lib/docs";
import { getAllBlogPosts, getAllTags, normalizeTag } from "@/lib/blog";
import { providerImports, useCases } from "@/lib/content";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes = [
  "", "/about", "/accessibility", "/blog", "/changelog", "/contact", "/cookies", "/docs",
  "/embed", "/faq", "/feed.xml", "/import", "/pricing", "/privacy", "/security", "/status",
  "/subprocessors", "/terms", "/use-cases",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllBlogPosts();
  const latestUpdate = posts.reduce((latest, post) => post.updatedAt > latest ? post.updatedAt : latest, "2026-07-12");
  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(route || "/"),
    lastModified: new Date(`${latestUpdate}T12:00:00Z`),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/blog" || route === "/use-cases" ? 0.8 : 0.6,
  }));

  entries.push(
    ...docsIndex.map((doc) => ({ url: absoluteUrl(`/docs/${doc.slug}`), lastModified: new Date("2026-07-12T12:00:00Z"), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...posts.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: new Date(`${post.updatedAt}T12:00:00Z`), changeFrequency: "monthly" as const, priority: 0.8 })),
    ...getAllTags().map((tag) => ({ url: absoluteUrl(`/blog/tag/${normalizeTag(tag)}`), lastModified: new Date(`${latestUpdate}T12:00:00Z`), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...useCases.map((entry) => ({ url: absoluteUrl(`/use-cases/${entry.slug}`), lastModified: new Date("2026-07-12T12:00:00Z"), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...providerImports.map((entry) => ({ url: absoluteUrl(`/import/${entry.slug}`), lastModified: new Date("2026-07-12T12:00:00Z"), changeFrequency: "monthly" as const, priority: 0.7 })),
  );

  return entries;
}
