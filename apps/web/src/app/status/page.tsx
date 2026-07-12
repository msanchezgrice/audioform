import type { Metadata } from "next";
import { PageHero, Prose } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "Service status", description: "Talkform service-status scope, incident contact, and current limitations of this manually maintained page.", path: "/status" });

export default function StatusPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Status" title="Service status" description="No active incident is recorded on this manually maintained page as of July 12, 2026. This is not yet a realtime uptime monitor." />
    <Prose>
      <h2>Public website</h2><p>Status: no incident recorded. The website and documentation depend on the production hosting deployment.</p>
      <h2>Voice interviews</h2><p>Status: no incident recorded. Session availability also depends on browser media support and OpenAI Realtime service health.</p>
      <h2>Public form import</h2><p>Status: no incident recorded. Provider page changes, access restrictions, and unsupported fields can cause individual imports to fail.</p>
      <h2>Report an issue</h2><p>Email <a href="mailto:support@talkform.ai">support@talkform.ai</a> with the affected URL and approximate time. A hosted, automatically updated incident system and historical uptime metrics have not yet been published.</p>
    </Prose>
  </main>;
}
