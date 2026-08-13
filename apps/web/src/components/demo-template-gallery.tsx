"use client";

import { useState } from "react";
import type { AudioformConfig } from "@talkform/core";
import { emitTalkformEvent } from "@talkform/react";
import { AudioformClient } from "@/components/audioform-client";
import styles from "./demo-template-gallery.module.css";

type DemoTemplateGalleryProps = {
  templates: AudioformConfig[];
  initialTemplateId?: string;
  vendorUrl?: string;
  voiceEnabled?: boolean;
};

export function DemoTemplateGallery({ templates, initialTemplateId, vendorUrl, voiceEnabled = false }: DemoTemplateGalleryProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates.some((template) => template.id === initialTemplateId)
      ? initialTemplateId ?? ""
      : templates[0]?.id ?? "",
  );
  const [consumerMode, setConsumerMode] = useState(false);
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

  if (!selectedTemplate) {
    return null;
  }

  return (
    <div className={styles.shell}>
      <section className={styles.header}>
        <div className={styles.eyebrow}>Template examples</div>
        <h1>Try a Talkform interview</h1>
        <p>
          These examples are modeled after common Typeform-style starting points so the product feels closer to an
          actual form builder instead of a single canned onboarding flow.
        </p>

        <div className={styles.templateGrid}>
          {templates.map((template) => {
            const isActive = template.id === selectedTemplate.id;
            return (
              <button
                key={template.id}
                type="button"
                className={`${styles.templateCard}${isActive ? ` ${styles.templateCardActive}` : ""}`}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  emitTalkformEvent("template_selected", { templateId: template.id });
                }}
                aria-pressed={isActive}
                data-agent-action="select-template"
                data-testid={`template-card-${template.id}`}
              >
                <span className={styles.templateMeta}>{isActive ? "Selected" : "Example"}</span>
                <strong>{template.title}</strong>
                <p>{template.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.modeRow}>
        <div className={styles.viewSwitch} role="group" aria-label="Demo view" data-testid="view-mode-toggle">
          <button
            type="button"
            aria-pressed={!consumerMode}
            className={`${styles.viewOption}${!consumerMode ? ` ${styles.viewOptionActive}` : ""}`}
            onClick={() => {
              if (!consumerMode) return;
              setConsumerMode(false);
              emitTalkformEvent("view_mode_selected", { view: "developer" });
            }}
          >
            Developer view
          </button>
          <button
            type="button"
            aria-pressed={consumerMode}
            className={`${styles.viewOption}${consumerMode ? ` ${styles.viewOptionActive}` : ""}`}
            onClick={() => {
              if (consumerMode) return;
              setConsumerMode(true);
              emitTalkformEvent("view_mode_selected", { view: "consumer" });
            }}
          >
            End-user view
          </button>
        </div>
        <span className={styles.modeHint}>
          {consumerMode ? "The minimal interview your end-users see" : "Full view with sidebar, transcript, and exports"}
        </span>
      </div>

      <AudioformClient
        key={`${selectedTemplate.id}-${consumerMode}`}
        config={selectedTemplate}
        heading={`${selectedTemplate.title} demo`}
        subheading={selectedTemplate.description ?? "Run the live Talkform demo against this example form type."}
        vendorUrl={vendorUrl}
        consumerMode={consumerMode}
        voiceEnabled={voiceEnabled}
      />
    </div>
  );
}
