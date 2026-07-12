import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "../_components/content";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({ title: "Accessibility statement", description: "Talkform's accessibility goals, known limitations, supported input choices, and feedback channel.", path: "/accessibility" });

export default function AccessibilityPage() {
  return <PolicyPage eyebrow="Trust" title="Accessibility statement" description="Talkform aims to make guided interviews perceivable, operable, understandable, and robust across voice and text." sections={[
    { title: "Our goal", content: <p>We aim toward WCAG 2.2 Level AA for the public website and core interview flow. Voice is intended as an optional input method. Prompts should remain visible, the flow should be keyboard operable, and users should be able to type, review, and correct answers.</p> },
    { title: "Known limitations", content: <p>Talkform is still being tested. Realtime connection state, transcript updates, focus behavior, imported form semantics, long option lists, browser microphone errors, and some mobile layouts may not yet work equally for every assistive technology. Imported content can introduce additional accessibility problems that the form owner must review.</p> },
    { title: "Using the interview", content: <p>You should be able to decline microphone permission and continue by typing. If audio, animation, or a custom control creates a barrier, stop the interview and contact the form owner. Do not share sensitive information through a support message.</p> },
    { title: "Feedback", content: <p>Email <a href="mailto:support@talkform.ai">support@talkform.ai</a> with the page, browser, assistive technology if you wish to name it, and a description of the barrier. We cannot promise a fixed response time yet, but accessibility reports should be triaged as product defects. Read our detailed <Link href="/blog/voice-forms-accessibility">voice forms accessibility guide</Link>.</p> },
  ]} />;
}
