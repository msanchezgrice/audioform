"use client";

import { useState } from "react";
import type { AudioformConfig } from "@talkform/core";
import { AudioformClient } from "@/components/audioform-client";
import styles from "./demo-template-gallery.module.css";

type DemoTemplateGalleryProps = {
  templates: AudioformConfig[];
  vendorUrl?: string;
};

export function DemoTemplateGallery({ templates, vendorUrl }: DemoTemplateGalleryProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
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
        <h2>Switch the live demo between real form types</h2>
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
                onClick={() => setSelectedTemplateId(template.id)}
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
        <span className={`${styles.modeLabel} ${!consumerMode ? styles.modeLabelActive : ""}`}>Developer</span>
        <button
          type="button"
          className={`${styles.modeToggle} ${consumerMode ? styles.modeToggleActive : ""}`}
          onClick={() => setConsumerMode(!consumerMode)}
          aria-label="Toggle consumer view"
        >
          <span className={styles.modeThumb} />
        </button>
        <span className={`${styles.modeLabel} ${consumerMode ? styles.modeLabelActive : ""}`}>Consumer</span>
        <span className={styles.modeHint}>
          {consumerMode ? "Minimal view your end-users see" : "Full view with sidebar and exports"}
        </span>
      </div>

      <AudioformClient
        key={`${selectedTemplate.id}-${consumerMode}`}
        config={selectedTemplate}
        heading={`${selectedTemplate.title} demo`}
        subheading={selectedTemplate.description ?? "Run the live Talkform demo against this example form type."}
        vendorUrl={vendorUrl}
        consumerMode={consumerMode}
      />
    </div>
  );
}
