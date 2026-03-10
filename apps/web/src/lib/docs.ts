import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "../..");
const docsRoot = path.join(repoRoot, "docs");

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
  const content = await fs.readFile(path.join(docsRoot, entry.file), "utf8");
  return {
    ...entry,
    content,
  };
}

