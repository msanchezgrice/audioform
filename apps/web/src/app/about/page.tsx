import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Prose } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

export const metadata: Metadata = createMetadata({ title: "About Talkform", description: "Why Talkform is building accessible, reviewable browser voice interviews that export dependable structured answers.", path: "/about" });

export default function AboutPage() {
  return <main className={styles.page}>
    <PageHero eyebrow="About" title="A more natural way to complete structured forms" description="Talkform explores a simple product idea: a form can feel like a guided interview without giving up structure, correction, or user control." />
    <Prose>
      <h2>What exists today</h2>
      <p>Talkform can import supported fields from a public form URL into an editable draft, run a browser voice or text interview, show captured answers, and export structured JSON. It also includes documentation and experimental developer packages. Provider fidelity, embed surfaces, storage, and integrations must be evaluated against the current product rather than assumed from a concept.</p>
      <h2>How we want to build</h2>
      <p>Voice should remain optional. Exact values should be easy to correct. Models should help gather and structure information without making hidden consequential decisions. Privacy, security, accessibility, and honest product claims are release criteria.</p>
      <h2>Talk with us</h2>
      <p>Questions, accessibility feedback, and security reports can be sent to <a href="mailto:support@talkform.ai">support@talkform.ai</a>. The public site does not yet publish a legal company name, team roster, office address, customer logos, or funded-company story, so this page does not invent them.</p>
      <p><Link href="/use-cases">Explore use cases</Link> or <Link href="/blog">read the implementation guides</Link>.</p>
    </Prose>
  </main>;
}
