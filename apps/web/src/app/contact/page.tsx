import type { Metadata } from "next";
import { PageHero, Prose } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "Contact", description: "Contact Talkform about product questions, accessibility barriers, privacy requests, or security concerns.", path: "/contact" });

export default function ContactPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="Contact" title="How can we help?" description="Use one monitored address for product questions, access requests, accessibility feedback, and responsible security reports." />
    <Prose>
      <h2>Email</h2>
      <p><a href="mailto:support@talkform.ai">support@talkform.ai</a></p>
      <p>Include the page or interview URL, approximate date, what you expected, and what happened. Do not email passwords, API keys, payment card data, government identifiers, health records, or another person&apos;s interview answers.</p>
      <h2>Privacy and accessibility</h2>
      <p>For a privacy request, name the form owner if another organization provided the interview and include a safe way to verify the request. For an accessibility barrier, include your browser and assistive technology only if you are comfortable doing so.</p>
      <h2>Response expectations</h2>
      <p>Talkform does not currently publish a guaranteed response time, phone number, office address, or live-chat service. Security reports should use the same address with “Security” in the subject.</p>
    </Prose>
  </main>;
}
