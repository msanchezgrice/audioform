import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, PageHero, Prose } from "../_components/content";
import { createMetadata } from "@/lib/seo";
import styles from "../content.module.css";

const faqs = [
  { question: "What does Talkform do today?", answer: "Talkform can turn supported fields from a public form URL into an editable draft, run a guided browser voice or text interview, and export structured JSON." },
  { question: "Is microphone access required?", answer: "No. Typing is available without a realtime audio connection and stays in your browser until export. A text-only deployment never requests microphone permission." },
  { question: "Does importing change my original form?", answer: "No. The current importer reads a public responder experience and creates a separate draft. Review every extracted field and limitation." },
  { question: "Which providers are supported?", answer: "The importer recognizes common patterns from Typeform, Google Forms, Jotform, and HubSpot public forms. Complex logic, uploads, payments, widgets, restricted forms, and provider automation may require manual work." },
  { question: "How much does Talkform cost?", answer: "Core text handoffs are free. Machine workspaces start with 10 text handoffs per day; an optional signed-in human claim enables up to 100 per day per project. Respondent links and completed results stay available for 7 days. Voice is optional under shared limits, and no payment or business email is required." },
  { question: "Can an agent register without a human account?", answer: "Yes. An agent can register a machine workspace with a fresh idempotency key through the HTTP API or hosted MCP tool, then save the one-time project secret. No email address or Clerk user is created. A signed-in human claim is optional and enables the human-owned project limit and optional voice." },
  { question: "What is a hosted handoff?", answer: "A hosted handoff gives a respondent a Talkform link to review and submit structured answers for your project. The link expires after 7 days, and a completed result remains available to the project for 7 days." },
  { question: "Can I receive a completion webhook?", answer: "Yes. Configure an HTTPS public port 443 endpoint with the project API key. Talkform signs handoff.completed events, sends no answers in the event, retries delivery up to seven attempts, and lets your receiver fetch the reviewed result with the project key." },
  { question: "What happens in voice mode?", answer: "Talkform’s server creates a bounded realtime session after you choose voice and enforces its call duration and shared usage limits; your browser then streams microphone audio directly to OpenAI. In the public demo, transcript, summary, and structured answers are stored only in your browser until export." },
  { question: "Is audio stored?", answer: "Talkform does not proxy or store the public demo audio stream. OpenAI processes the audio for the live session under the applicable OpenAI service terms and configuration. Transcript, summary, and structured answers remain browser-local until export." },
  { question: "Can Talkform make decisions from someone's voice?", answer: "Talkform should not infer protected traits, emotion, honesty, or suitability from voice, and should not make unreviewed consequential decisions." },
  { question: "Is Talkform certified for regulated data?", answer: "No certification or regulated-data eligibility is claimed on this site. Do not submit highly sensitive information without a written review." },
  { question: "How do I report a problem?", answer: "Email support@talkform.ai with the page, approximate time, and safe reproduction details. Do not include secrets or another person's data." },
];

export const metadata: Metadata = createMetadata({ title: "Frequently asked questions", description: "Straight answers about Talkform imports, voice and text input, data handling, supported providers, limitations, and support.", path: "/faq" });

export default function FaqPage() {
  return <main className={styles.page}>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }} />
    <PageHero eyebrow="FAQ" title="Questions, answered plainly" description="The current product boundary, provider limitations, data handling, accessibility, and support." />
    <Prose>
      {faqs.map((faq) => <section key={faq.question}><h2>{faq.question}</h2><p>{faq.answer}</p></section>)}
      <p>Still unsure? Read the <Link href="/privacy">privacy policy</Link>, <Link href="/security">security page</Link>, or email <a href="mailto:support@talkform.ai">support@talkform.ai</a>.</p>
    </Prose>
  </main>;
}
