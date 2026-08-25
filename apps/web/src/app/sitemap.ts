import type { MetadataRoute } from "next";
import { docsIndex } from "@/lib/docs";
import { getAllBlogPosts } from "@/lib/blog";
import { providerImports, useCases } from "@/lib/content";
import { solutions } from "@/lib/solutions";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes = [
  "", "/about", "/accessibility", "/blog", "/changelog", "/contact", "/cookies", "/docs",
  "/embed", "/evidence/agent-readiness", "/faq", "/import", "/pilot", "/pricing", "/privacy", "/security", "/solutions", "/status",
  "/subprocessors", "/terms", "/use-cases",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllBlogPosts();
  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(route || "/"),
  }));

  entries.push(
    ...docsIndex.map((doc) => ({ url: absoluteUrl(`/docs/${doc.slug}`) })),
    ...posts.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: new Date(`${post.updatedAt}T12:00:00Z`) })),
    ...useCases.map((entry) => ({ url: absoluteUrl(`/use-cases/${entry.slug}`) })),
    ...solutions.map((solution) => ({ url: absoluteUrl(`/solutions/${solution.slug}`) })),
    ...providerImports.map((entry) => ({ url: absoluteUrl(`/import/${entry.slug}`) })),
  );

  return entries;
}
