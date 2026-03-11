import type { Metadata } from "next";
import Link from "next/link";
import { Outfit, Fraunces } from "next/font/google";
import "./globals.css";

const bodyFont = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://talkform.ai"),
  title: {
    default: "Talkform | Turn Any Form Into a Live Audio Interview",
    template: "%s | Talkform",
  },
  description:
    "Config-driven audio onboarding forms for products and AI agents. Ask out loud, fill structured fields directly, and export JSON-ready results.",
  openGraph: {
    title: "Talkform",
    description:
      "Turn any form into a live audio interview. Ask out loud, fill structured fields directly, and export JSON-ready results.",
    siteName: "Talkform",
    type: "website",
    url: "https://talkform.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talkform",
    description:
      "Config-driven audio onboarding forms for products and AI agents.",
  },
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/import", label: "Import" },
  { href: "/embed", label: "Embed" },
  { href: "/docs", label: "Docs" },
  { href: "/docs/agents", label: "Agents" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <div className="siteShell">
          <header className="siteHeader">
            <Link href="/" className="brandMark">
              <span className="brandDot">tf</span>
              Talkform
            </Link>
            <nav className="siteNav" aria-label="Primary">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
              <Link href="/app" className="ctaNav">Try demo</Link>
            </nav>
          </header>
          {children}
          <footer className="siteFooter">
            <div>
              <strong>Talkform</strong>
              <p>Audio-first forms for products and agents.</p>
            </div>
            <div className="footerLinks">
              <Link href="/docs">Docs</Link>
              <Link href="/docs/mcp">MCP</Link>
              <Link href="/docs/http-api">HTTP API</Link>
              <Link href="/docs/agents">Agents</Link>
              <a href="https://github.com/msanchezgrice/audioform" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
