"use client";

import Link from "next/link";
import { emitTalkformEvent } from "@talkform/react";
import styles from "../app/content.module.css";

type SolutionCtaProps = {
  solutionSlug: string;
  templateId: string;
};

export function SolutionCta({ solutionSlug, templateId }: SolutionCtaProps) {
  const demoHref = `/app?template=${templateId}`;

  function recordClick(destination: string) {
    emitTalkformEvent("conversion_clicked", {
      source: "solution_page",
      useCaseId: solutionSlug,
      destination,
    });
  }

  return (
    <aside className={styles.ctaBand}>
      <div>
        <h2>Try the workflow with sample fields</h2>
        <p>The demo keeps transcript, summary, and answers browser-local until you export.</p>
      </div>
      <div className={styles.actions}>
        <Link
          href={demoHref}
          className={styles.primaryButton}
          onClick={() => recordClick(demoHref)}
          data-agent-action="try-solution-demo"
          data-testid={`solution-demo-${solutionSlug}`}
        >
          Open the matching demo
        </Link>
        <Link
          href="/import"
          className={styles.secondaryButton}
          onClick={() => recordClick("/import")}
          data-agent-action="import-form"
          data-testid={`solution-import-${solutionSlug}`}
        >
          Import a public form
        </Link>
      </div>
    </aside>
  );
}
