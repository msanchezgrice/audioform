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
  { question: "What happens in voice mode?", answer: "Talkform issues a short-lived realtime token, then your browser streams microphone audio directly to OpenAI. In the public demo, transcript, summary, and structured answers stay in your browser until export; the Talkform server does not retain them." },
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
