import type { Metadata } from "next";
import { PolicyPage } from "../_components/content";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({ title: "Cookie notice", description: "The current Talkform cookie and local-storage notice, including essential browser state and future consent requirements.", path: "/cookies" });

export default function CookiesPage() {
  return <PolicyPage eyebrow="Legal" title="Cookie notice" description="This page explains browser storage used by Talkform and how any future non-essential tracking must be handled." sections={[
    { title: "Current approach", content: <p>Talkform does not use advertising cookies. Product analytics is configured with in-memory, cookieless persistence and does not write an analytics cookie or analytics state to local storage. Talkform also disables that analytics path when the browser sends Global Privacy Control or Do Not Track.</p> },
    { title: "Essential cookie", content: <><p><code>talkform_owner</code> is a randomly generated, HTTP-only essential cookie used to scope protected browser API requests and abuse controls to the browser that created them. It does not contain an interview answer, transcript, email address, or advertising identifier.</p><p>On HTTPS it is Secure, SameSite=None, and Partitioned so an approved embedded experience can maintain isolated browser ownership. Its maximum age is 24 hours. The public text interview itself uses in-memory browser state and clears when the page is refreshed or closed.</p></> },
    { title: "Analytics and payment services", content: <p>Server logs and privacy-limited events may be used to understand acquisition, reliability, and product stages without placing answer text, transcripts, business email, or form URLs into analytics. PostHog and Google Analytics receive only an approved event and property set when analytics is allowed. If an accepted pilot continues to Stripe Checkout, Stripe may use essential security and fraud-prevention storage on its checkout domain under its own policy.</p> },
    { title: "Your controls", content: <p>You can inspect, block, or delete cookies and site data through browser settings. Blocking the essential owner cookie may prevent protected API continuity, while clearing or refreshing an active browser interview clears its in-memory progress. Questions about a specific cookie can be sent to <a href="mailto:support@talkform.ai">support@talkform.ai</a>.</p> },
  ]} />;
}
