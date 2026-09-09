import type { Metadata } from "next";
import Link from "next/link";
import { Outfit, Fraunces } from "next/font/google";
import { createMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { AuthProvider } from "@/components/auth-provider";
import { TalkformGoogleAnalytics } from "@/components/talkform-google-analytics";
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
  ...createMetadata({
    title: "Talkform | Turn a form into a guided voice interview",
    description: "Import a public form, run a guided browser voice or text interview, review structured answers, and export clean JSON.",
    path: "/",
  }),
  metadataBase: new URL("https://www.talkform.ai"),
  title: {
    default: "Talkform | Turn a form into a guided voice interview",
    template: "%s | Talkform",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

const navItems = [
  { href: "/solutions", label: "Solutions" },
  { href: "/use-cases", label: "Use Cases" },
  { href: "/import", label: "Import" },
  { href: "/blog", label: "Blog" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/sign-in", label: "Sign in" },
];

const footerGroups = [
  { title: "Product", links: [{ href: "/app", label: "Demo" }, { href: "/import", label: "Import" }, { href: "/solutions", label: "Solutions" }, { href: "/use-cases", label: "Use cases" }, { href: "/pricing", label: "Pricing" }] },
  { title: "Resources", links: [{ href: "/blog", label: "Blog" }, { href: "/docs", label: "Docs" }, { href: "/faq", label: "FAQ" }, { href: "/changelog", label: "Changelog" }, { href: "/feed.xml", label: "RSS" }] },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/contact", label: "Contact" }, { href: "/status", label: "Status" }, { href: "/security", label: "Security" }, { href: "/accessibility", label: "Accessibility" }] },
  { title: "Legal", links: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }, { href: "/cookies", label: "Cookies" }, { href: "/subprocessors", label: "Subprocessors" }] },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function () {
          var isRespondent = function (path) { return path === '/respond' || path.indexOf('/respond/') === 0; };
          var trackingAllowed = function () {
            return navigator.doNotTrack !== '1' && window.doNotTrack !== '1' && navigator.globalPrivacyControl !== true && window.globalPrivacyControl !== true;
          };
          var routePath = function (url) {
            try { return new URL(url || window.location.href, window.location.href).pathname; } catch (_) { return window.location.pathname; }
          };
          var updateRoute = function (path) {
            var blocked = isRespondent(path || window.location.pathname);
            window.__talkformRespondentRoute = blocked;
            window.__talkformAnalyticsBlocked = blocked;
            window.dispatchEvent(new CustomEvent('talkform:route-change', { detail: { respondent: blocked } }));
          };
          ['pushState', 'replaceState'].forEach(function (method) {
            var original = window.history[method];
            window.history[method] = function () {
              var nextUrl = null;
              try { nextUrl = arguments.length > 2 && arguments[2] ? new URL(arguments[2], window.location.href).href : null; } catch (_) {}
              var nextPath = nextUrl ? routePath(nextUrl) : window.location.pathname;
              if (isRespondent(nextPath) && !isRespondent(window.location.pathname) && nextUrl) {
                updateRoute(nextPath);
                window.location.assign(nextUrl);
                return;
              }
              updateRoute(nextPath);
              var result = original.apply(this, arguments);
              updateRoute();
              return result;
            };
          });
          window.addEventListener('popstate', function () { updateRoute(); });
          updateRoute();
          if (window.__talkformRespondentRoute || !trackingAllowed()) return;
          var script = document.createElement('script');
          script.src = 'https://analytics.ahrefs.com/analytics.js';
          script.dataset.key = 'WTZ2mV2darTRiyE51Tb5hA';
          script.dataset.talkformAhrefs = 'true';
          script.async = true;
          document.head.appendChild(script);
        })();` }} />
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <TalkformGoogleAnalytics measurementId={process.env.NEXT_PUBLIC_TALKFORM_GA_MEASUREMENT_ID} />
        <AuthProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, websiteJsonLd]).replace(/</g, "\\u003c") }} />
        <a className="skipLink" href="#main-content">Skip to main content</a>
        <div className="siteShell">
          <header className="siteHeader">
            <Link href="/" className="brandMark" data-testid="nav-brand">
              <svg className="brandIcon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <path d="M32 4C17.088 4 5 14.745 5 28c0 7.41 3.73 14.08 9.62 18.68L11 56l10.92-5.46C24.34 51.5 28.08 52 32 52c14.912 0 27-10.745 27-24S46.912 4 32 4z" fill="var(--accent)"/>
                <rect x="22" y="20" width="3" height="16" rx="1.5" fill="#fff"/>
                <rect x="28" y="15" width="3" height="26" rx="1.5" fill="#fff"/>
                <rect x="34" y="18" width="3" height="20" rx="1.5" fill="#fff"/>
                <rect x="40" y="22" width="3" height="12" rx="1.5" fill="#fff"/>
              </svg>
              Talkform
            </Link>
            <nav className="siteNav" aria-label="Primary" data-agent-nav="primary" data-testid="nav-primary">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} data-testid={`nav-link-${item.href.slice(1)}`}>
                  {item.label}
                </Link>
              ))}
              <Link href="/dashboard" className="ctaNav" data-agent-action="get-started-free" data-testid="nav-cta-get-started-free">Get started free</Link>
            </nav>
            <details className="mobileNav">
              <summary>Menu</summary>
              <nav className="mobileNavPanel" aria-label="Mobile primary" data-agent-nav="primary">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
                <Link href="/dashboard" className="mobileNavCta" data-agent-action="get-started-free">Get started free</Link>
              </nav>
            </details>
          </header>
          <div id="main-content">{children}</div>
          <footer className="siteFooter">
            <div className="footerBrand">
              <strong>Talkform</strong>
              <p>Guided browser voice interviews with reviewable structured answers.</p>
              <a href="mailto:support@talkform.ai">support@talkform.ai</a>
              <a href="https://twelve.tools" target="_blank">
                <img src="https://twelve.tools/badge1-light.svg" alt="Featured on Twelve Tools" width="148" height="40" />
              </a>
            </div>
            <div className="footerGroups">
              {footerGroups.map((group) => (
                <nav key={group.title} className="footerGroup" aria-label={`${group.title} links`} data-agent-nav="footer">
                  <strong>{group.title}</strong>
                  {group.links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
                </nav>
              ))}
            </div>
          </footer>
        </div>
        </AuthProvider>
      </body>
    </html>
  );
}
