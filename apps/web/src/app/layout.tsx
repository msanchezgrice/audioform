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
    "Turn any form into a live audio interview. Ask out loud, fill structured fields, and export clean JSON for your apps, workflows, and agents.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Talkform — Audio-first forms",
    description:
      "Turn any form into a live audio interview. Talkform asks questions out loud, fills structured fields from the conversation, and exports clean JSON.",
    siteName: "Talkform",
    type: "website",
    url: "https://talkform.ai",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Talkform — Turn any form into a live audio interview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talkform — Audio-first forms",
    description:
      "Turn any form into a live audio interview. Ask out loud, fill structured fields, export clean JSON.",
    images: ["/og-image.png"],
  },
  other: {
    "og:locale": "en_US",
    "og:image:type": "image/png",
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
              <svg className="brandIcon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <path d="M32 4C17.088 4 5 14.745 5 28c0 7.41 3.73 14.08 9.62 18.68L11 56l10.92-5.46C24.34 51.5 28.08 52 32 52c14.912 0 27-10.745 27-24S46.912 4 32 4z" fill="var(--accent)"/>
                <rect x="22" y="20" width="3" height="16" rx="1.5" fill="#fff"/>
                <rect x="28" y="15" width="3" height="26" rx="1.5" fill="#fff"/>
                <rect x="34" y="18" width="3" height="20" rx="1.5" fill="#fff"/>
                <rect x="40" y="22" width="3" height="12" rx="1.5" fill="#fff"/>
              </svg>
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
