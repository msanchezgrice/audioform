import type { Metadata } from "next";

export const SITE_NAME = "Talkform";
export const SITE_URL = "https://www.talkform.ai";
export const DEFAULT_DESCRIPTION =
  "Turn a public form into a guided browser voice interview, review structured answers, and export clean JSON.";

type MetadataInput = {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  noIndex?: boolean;
};

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, SITE_URL).toString();
}

export function createMetadata({
  title,
  description,
  path = "/",
  type = "website",
  publishedTime,
  modifiedTime,
  tags,
  noIndex = false,
}: MetadataInput): Metadata {
  const canonical = absoluteUrl(path);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      locale: "en_US",
      type,
      url: canonical,
      publishedTime,
      modifiedTime,
      tags,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          type: "image/png",
          alt: `${title} — ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  alternateName: "Talkform.ai",
  url: SITE_URL,
  logo: absoluteUrl("/icon.svg"),
  email: "support@talkform.ai",
  sameAs: ["https://github.com/msanchezgrice/audioform"],
  description: "Talkform is the guided browser voice-interview product published at talkform.ai.",
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
};
