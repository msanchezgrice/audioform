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
    description: "Choose the hosted API, MCP, Python, React, or local development path.",
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
    description: "Create durable hosted handoffs and retrieve reviewed structured results.",
    file: "http-api.md",
  },
  {
    slug: "python-example",
    title: "Python example",
    description: "Run a no-dependency hosted handoff client with bounded polling and safe retries.",
    file: "python-example.md",
  },
  {
    slug: "python-webhook-receiver",
    title: "Python webhook receiver",
    description: "Verify signed completion events, deduplicate deliveries, and fetch reviewed JSON.",
    file: "python-webhook-receiver.md",
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
    description: "Use local config tools or authenticated hosted handoff tools through MCP.",
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
    content: content.replace(/^#\s+[^\r\n]+\r?\n+/, ""),
  };
}
