import type { Metadata } from "next";
import { PolicyPage } from "../_components/content";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({ title: "Cookie notice", description: "The current Talkform cookie and local-storage notice, including essential browser state and future consent requirements.", path: "/cookies" });

export default function CookiesPage() {
  return <PolicyPage eyebrow="Legal" title="Cookie notice" description="This page explains browser storage used by Talkform and how any future non-essential tracking must be handled." sections={[
    { title: "Current approach", content: <p>Talkform does not currently use advertising cookies or enable a non-essential analytics cookie on the public site. If non-essential analytics or advertising storage is introduced, it must be blocked until any required consent is obtained and this notice is updated.</p> },
    { title: "Essential cookie", content: <><p><code>talkform_owner</code> is a randomly generated, HTTP-only essential cookie used to scope protected browser API requests and abuse controls to the browser that created them. It does not contain an interview answer, transcript, email address, or advertising identifier.</p><p>On HTTPS it is Secure, SameSite=None, and Partitioned so an approved embedded experience can maintain isolated browser ownership. Its maximum age is 24 hours. The public text interview itself uses in-memory browser state and clears when the page is refreshed or closed.</p></> },
    { title: "Analytics and third parties", content: <p>Server logs and privacy-limited product events may be used to understand reliability without placing answer or transcript content into analytics. The current custom product event does not itself set a cookie. Third-party embeds or integrations can set their own storage under their policies; Talkform will disclose those services before activating them.</p> },
    { title: "Your controls", content: <p>You can inspect, block, or delete cookies and site data through browser settings. Blocking the essential owner cookie may prevent protected API continuity, while clearing or refreshing an active browser interview clears its in-memory progress. Questions about a specific cookie can be sent to <a href="mailto:support@talkform.ai">support@talkform.ai</a>.</p> },
  ]} />;
}
