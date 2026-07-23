"use client";

import { useState } from "react";
import Link from "next/link";
import type { AudioformConfig } from "@talkform/core";
import {
  CUSTOMER_FEEDBACK_TEMPLATE,
  CUSTOMER_ONBOARDING_TEMPLATE,
  JOB_APPLICATION_TEMPLATE,
  LEAD_GENERATION_TEMPLATE,
  NPS_SURVEY_TEMPLATE,
  PRODUCT_PERSONALIZATION_TEMPLATE,
  USER_RESEARCH_TEMPLATE,
} from "@talkform/core";
import { emitTalkformEvent } from "@talkform/react";
import { AudioformClient } from "@/components/audioform-client";
import styles from "./live-demo-showcase.module.css";

type UseCase = {
  id: string;
  name: string;
  shortDesc: string;
  icon: React.ReactNode;
  template: AudioformConfig;
};

const USE_CASES: UseCase[] = [
  {
    id: "onboarding",
    name: "Onboarding interview",
    shortDesc: "Welcome new users out loud",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h2" />
      </svg>
    ),
    template: CUSTOMER_ONBOARDING_TEMPLATE,
  },
  {
    id: "personalization",
    name: "Personalization quiz",
    shortDesc: "Tune the product to each user",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
        <path d="M18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9z" />
      </svg>
    ),
    template: PRODUCT_PERSONALIZATION_TEMPLATE,
  },
  {
    id: "survey",
    name: "Survey / NPS",
    shortDesc: "Scores plus the why behind them",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 14a8 8 0 1 1 16 0" />
        <path d="M12 14l3.5-3.5" />
        <path d="M2 20h20" />
      </svg>
    ),
    template: NPS_SURVEY_TEMPLATE,
  },
  {
    id: "lead-qualification",
    name: "Lead qualification",
    shortDesc: "Qualify while attention is high",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.5" />
      </svg>
    ),
    template: LEAD_GENERATION_TEMPLATE,
  },
  {
    id: "user-research",
    name: "User research",
    shortDesc: "Open-ended discovery at scale",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.5-4.5" />
        <path d="M11 8v3l2 2" />
      </svg>
    ),
    template: USER_RESEARCH_TEMPLATE,
  },
  {
    id: "customer-feedback",
    name: "Customer feedback",
    shortDesc: "Verbatims your team can act on",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" />
      </svg>
    ),
    template: CUSTOMER_FEEDBACK_TEMPLATE,
  },
  {
    id: "intake-screening",
    name: "Intake & screening",
    shortDesc: "Applications without the typing",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4a3 3 0 0 1 6 0" />
        <path d="M9 11h6M9 15h4" />
      </svg>
    ),
    template: JOB_APPLICATION_TEMPLATE,
  },
];

const CHECK_ICON = (
  <svg viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

type LiveDemoShowcaseProps = {
  vendorUrl?: string;
  voiceEnabled?: boolean;
};

export function LiveDemoShowcase({ vendorUrl, voiceEnabled = false }: LiveDemoShowcaseProps) {
  const [selectedUseCaseId, setSelectedUseCaseId] = useState(USE_CASES[0].id);
  const selectedUseCase = USE_CASES.find((uc) => uc.id === selectedUseCaseId) ?? USE_CASES[0];

  return (
    <div>
      <div className={styles.demoGrid}>
        <nav className={styles.rail} aria-label="Demo use cases">
          <div className={styles.railLabel}>Use cases</div>
          {USE_CASES.map((uc) => {
            const isActive = uc.id === selectedUseCase.id;
            return (
              <button
                key={uc.id}
                type="button"
                className={`${styles.railItem}${isActive ? ` ${styles.railItemActive}` : ""}`}
                onClick={() => {
                  setSelectedUseCaseId(uc.id);
                  emitTalkformEvent("landing_demo_use_case_selected", { useCaseId: uc.id });
                }}
                aria-pressed={isActive}
              >
                <span className={styles.railIcon}>{uc.icon}</span>
                <span>
                  <span className={styles.railName}>{uc.name}</span>
                  <span className={styles.railDesc}>{uc.shortDesc}</span>
                </span>
                <span className={styles.railCheck}>{CHECK_ICON}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.stage}>
          <AudioformClient
            key={selectedUseCase.template.id}
            config={selectedUseCase.template}
            heading={selectedUseCase.name}
            subheading={selectedUseCase.shortDesc}
            vendorUrl={vendorUrl}
            consumerMode
            voiceEnabled={voiceEnabled}
          />
        </div>
      </div>

      <div className={styles.demoFootRow}>
        <Link href="/app" className={styles.primaryAction}>
          Run the full live demo →
        </Link>
        <Link href="/use-cases" className={styles.ghostAction}>
          Explore all use cases
        </Link>
        <span className={styles.scriptedNote}>
          Pick a use case, answer aloud, and watch the structured result build.
        </span>
      </div>
    </div>
  );
}
