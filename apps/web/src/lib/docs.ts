import fs from "node:fs/promises";
import path from "node:path";

const docsRoots = () => [
  path.join(/* turbopackIgnore: true */ process.cwd(), "content", "docs"),
  path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..", "content", "docs"),
];

export const docsIndex = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Install, configure env vars, and launch Talkform locally or on Vercel.",
    file: "getting-started.md",
  },
  {
    slug: "configuration",
    title: "Configuration",
    description: "The config schema, field types, and prompt design model.",
    file: "configuration.md",
  },
  {
    slug: "react",
    title: "React",
    description: "Embed Talkform inside a React or Next.js product.",
    file: "react.md",
  },
  {
    slug: "http-api",
    title: "HTTP API",
    description: "Session bootstrap, export routes, and validation endpoints.",
    file: "http-api.md",
  },
  {
    slug: "cli",
    title: "CLI",
    description: "Scaffold configs, validate them, and export sessions from the command line.",
    file: "cli.md",
  },
  {
    slug: "mcp",
    title: "MCP",
    description: "Expose Talkform to AI agents through MCP tools and resources.",
    file: "mcp.md",
  },
  {
    slug: "agents",
    title: "Agents",
    description: "Recommended end-to-end agent workflow for defining, running, and consuming Talkform sessions.",
    file: "agents.md",
  },
];

export async function getDocContent(slug: string) {
  const entry = docsIndex.find((doc) => doc.slug === slug);
  if (!entry) return null;

  let content: string | null = null;
  for (const docsRoot of docsRoots()) {
    try {
      content = await fs.readFile(path.join(/* turbopackIgnore: true */ docsRoot, entry.file), "utf8");
      break;
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  if (content === null) return null;

  return {
    ...entry,
    content,
  };
}
