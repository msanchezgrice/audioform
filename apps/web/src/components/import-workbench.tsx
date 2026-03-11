"use client";

import { startTransition, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { audioformConfigSchema, type AudioformConfig, type AudioformField, type AudioformFieldType } from "@talkform/core";
import { AudioformClient } from "@/components/audioform-client";
import styles from "./import-workbench.module.css";

type ImportProvider = "typeform" | "google-forms" | "jotform" | "hubspot" | "generic";

type ImportedQuestion = {
  id: string;
  prompt: string;
  type: string;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
};

type ImportApiResponse = {
  ok: true;
  provider: ImportProvider;
  strategyUsed: string;
  source: {
    title: string;
    description?: string;
    questions: ImportedQuestion[];
    warnings: string[];
    sourceLogic: {
      summary: string[];
    };
  };
  suggestedConfig: AudioformConfig;
  warnings: string[];
  sourceLogic: {
    summary: string[];
  };
  completeness: number;
};

type ImportWorkbenchProps = {
  vendorUrl?: string;
};

const FIELD_TYPE_OPTIONS: Array<{ value: AudioformFieldType; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "single_select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
];

function supportsOptions(type: AudioformFieldType) {
  return type === "single_select" || type === "multi_select";
}

function formatProvider(provider: ImportProvider) {
  switch (provider) {
    case "google-forms":
      return "Google Forms";
    case "hubspot":
      return "HubSpot";
    case "jotform":
      return "Jotform";
    case "typeform":
      return "Typeform";
    default:
      return "Generic";
  }
}

function formatStrategy(strategy: string) {
  return strategy
    .replace(/^playwright:/, "Playwright / ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function serializeOptions(field: AudioformField) {
  return (field.options ?? [])
    .map((option) => `${option.label}${option.value && option.value !== option.label ? ` | ${option.value}` : ""}`)
    .join("\n");
}

function parseOptions(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [labelPart, valuePart] = line.split("|").map((segment) => segment.trim());
      const label = labelPart || `Option ${index + 1}`;
      const optionValue = valuePart || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `option-${index + 1}`;

      return {
        label,
        value: optionValue,
      };
    });
}

export function ImportWorkbench({ vendorUrl = "" }: ImportWorkbenchProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imported, setImported] = useState<ImportApiResponse | null>(null);
  const [draftConfig, setDraftConfig] = useState<AudioformConfig | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);

  const reviewWarnings = useMemo(() => {
    if (!imported) {
      return [];
    }

    return Array.from(new Set([...imported.warnings, ...imported.source.warnings]));
  }, [imported]);

  function updateDraftField(fieldId: string, updater: (field: AudioformField) => AudioformField) {
    setDraftConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        fields: current.fields.map((field) => (field.id === fieldId ? updater(field) : field)),
      };
    });
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = url.trim();
    if (!nextUrl) {
      setError("Enter a public form URL to import.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setPreviewVisible(false);

    try {
      const response = await fetch("/api/import/url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: nextUrl }),
      });

      const payload = (await response.json().catch(() => ({}))) as ImportApiResponse & {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to import that form.");
      }

      startTransition(() => {
        setImported(payload);
        setDraftConfig(payload.suggestedConfig);
      });
    } catch (importError) {
      setImported(null);
      setDraftConfig(null);
      setError(importError instanceof Error ? importError.message : "Unable to import that form.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function launchPreview() {
    if (!draftConfig) {
      setError("Import a form before launching the preview.");
      return;
    }

    const parsed = audioformConfigSchema.safeParse(draftConfig);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the imported Talkform draft before launching.");
      return;
    }

    setError(null);
    setPreviewRevision((current) => current + 1);
    setPreviewVisible(true);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Import existing forms</div>
          <h1>Paste any public form URL. Talkform will extract it, map it, and let you ship the audio version fast.</h1>
          <p>
            The importer tries structured adapters first, then static HTML, embedded payloads, iframe discovery,
            rendered DOM parsing, and finally Playwright if the page needs a browser.
          </p>
        </div>

        <form className={styles.importCard} onSubmit={handleImport}>
          <label className={styles.inputLabel} htmlFor="import-url">
            Public form URL
          </label>
          <input
            id="import-url"
            name="import-url"
            type="url"
            className={styles.urlInput}
            placeholder="https://form.typeform.com/to/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          />
          <div className={styles.importActions}>
            <button type="submit" className={styles.primaryAction} disabled={isSubmitting}>
              {isSubmitting ? "Extracting…" : "Import form"}
            </button>
            <p className={styles.helperText}>Public forms only in v1. Final submit is never triggered against the source form.</p>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>
      </section>

      {imported && draftConfig ? (
        <>
          <section className={styles.metaGrid}>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>Provider</span>
              <strong>{formatProvider(imported.provider)}</strong>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>Strategy</span>
              <strong>{formatStrategy(imported.strategyUsed)}</strong>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>Completeness</span>
              <strong>{Math.round(imported.completeness * 100)}%</strong>
            </article>
            <article className={styles.metaCard}>
              <span className={styles.metaLabel}>Imported Questions</span>
              <strong>{imported.source.questions.length}</strong>
            </article>
          </section>

          <section className={styles.workspace}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.eyebrow}>Source form</div>
                  <h2>{imported.source.title}</h2>
                </div>
                <button type="button" className={styles.secondaryAction} onClick={launchPreview}>
                  Launch Talkform preview
                </button>
              </div>

              {imported.source.description ? <p className={styles.panelIntro}>{imported.source.description}</p> : null}

              {reviewWarnings.length > 0 ? (
                <div className={styles.warningBlock}>
                  <strong>Warnings</strong>
                  <ul>
                    {reviewWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {imported.sourceLogic.summary.length > 0 ? (
                <div className={styles.logicBlock}>
                  <strong>Source logic detected</strong>
                  <p>Imported for reference only. Talkform does not execute branching, scoring, or outcomes in v1.</p>
                  <ul>
                    {imported.sourceLogic.summary.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className={styles.questionList}>
                {imported.source.questions.map((question, index) => (
                  <article key={question.id} className={styles.questionCard}>
                    <span className={styles.questionIndex}>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{question.prompt}</strong>
                      <p>
                        {question.type.replace(/_/g, " ")}
                        {question.required ? " • required" : " • optional"}
                      </p>
                      {question.options?.length ? (
                        <div className={styles.optionRow}>
                          {question.options.map((option) => (
                            <span key={`${question.id}-${option.value}`} className={styles.optionChip}>
                              {option.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.eyebrow}>Talkform draft</div>
                  <h2>Edit before launch</h2>
                </div>
                <button type="button" className={styles.primaryAction} onClick={launchPreview}>
                  Launch preview
                </button>
              </div>

              <div className={styles.configStack}>
                <label className={styles.fieldLabel}>
                  <span>Title</span>
                  <input
                    type="text"
                    value={draftConfig.title}
                    onChange={(event) =>
                      setDraftConfig((current) => (current ? { ...current, title: event.target.value } : current))
                    }
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={draftConfig.description ?? ""}
                    onChange={(event) =>
                      setDraftConfig((current) =>
                        current
                          ? {
                              ...current,
                              description: event.target.value.trim() ? event.target.value : undefined,
                            }
                          : current,
                      )
                    }
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Instructions</span>
                  <textarea
                    rows={4}
                    value={draftConfig.instructions ?? ""}
                    onChange={(event) =>
                      setDraftConfig((current) =>
                        current
                          ? {
                              ...current,
                              instructions: event.target.value.trim() ? event.target.value : undefined,
                            }
                          : current,
                      )
                    }
                  />
                </label>
              </div>

              <div className={styles.fieldStack}>
                {draftConfig.fields.map((field, index) => (
                  <article key={field.id} className={styles.fieldCard}>
                    <div className={styles.fieldCardHeader}>
                      <strong>
                        {String(index + 1).padStart(2, "0")} · {field.id}
                      </strong>
                      <label className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) =>
                            updateDraftField(field.id, (current) => ({
                              ...current,
                              required: event.target.checked,
                            }))
                          }
                        />
                        Required
                      </label>
                    </div>

                    <div className={styles.fieldGrid}>
                      <label className={styles.fieldLabel}>
                        <span>Field label</span>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(event) =>
                            updateDraftField(field.id, (current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className={styles.fieldLabel}>
                        <span>Type</span>
                        <select
                          value={field.type}
                          onChange={(event) =>
                            updateDraftField(field.id, (current) => {
                              const nextType = event.target.value as AudioformFieldType;
                              return {
                                ...current,
                                type: nextType,
                                options:
                                  supportsOptions(nextType)
                                    ? current.options?.length
                                      ? current.options
                                      : [{ label: "Option 1", value: "option-1" }]
                                    : undefined,
                              };
                            })
                          }
                        >
                          {FIELD_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.fieldLabel}>
                        <span>Prompt title</span>
                        <input
                          type="text"
                          value={field.promptTitle}
                          onChange={(event) =>
                            updateDraftField(field.id, (current) => ({
                              ...current,
                              promptTitle: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className={styles.fieldLabel}>
                        <span>Placeholder</span>
                        <input
                          type="text"
                          value={field.placeholder ?? ""}
                          onChange={(event) =>
                            updateDraftField(field.id, (current) => ({
                              ...current,
                              placeholder: event.target.value.trim() ? event.target.value : undefined,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <label className={styles.fieldLabel}>
                      <span>Prompt detail</span>
                      <textarea
                        rows={3}
                        value={field.promptDetail}
                        onChange={(event) =>
                          updateDraftField(field.id, (current) => ({
                            ...current,
                            promptDetail: event.target.value,
                          }))
                        }
                      />
                    </label>

                    {supportsOptions(field.type) ? (
                      <label className={styles.fieldLabel}>
                        <span>Options</span>
                        <textarea
                          rows={Math.max(3, field.options?.length ?? 3)}
                          value={serializeOptions(field)}
                          onChange={(event) =>
                            updateDraftField(field.id, (current) => ({
                              ...current,
                              options: parseOptions(event.target.value),
                            }))
                          }
                        />
                        <small>One option per line. Use `Label | value` when you want a custom saved value.</small>
                      </label>
                    ) : null}
                  </article>
                ))}
              </div>
            </article>
          </section>

          {previewVisible ? (
            <section className={styles.previewSection}>
              <div className={styles.previewHeader}>
                <div>
                  <div className={styles.eyebrow}>Live preview</div>
                  <h2>{draftConfig.title}</h2>
                </div>
                <p>Each launch uses the current draft config. Imported logic remains reference-only in this v1 preview.</p>
              </div>
              <AudioformClient
                key={`preview-${previewRevision}`}
                config={draftConfig}
                heading={`${draftConfig.title} preview`}
                subheading={draftConfig.description ?? "Review the imported Talkform flow before publishing it."}
                vendorUrl={vendorUrl}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
