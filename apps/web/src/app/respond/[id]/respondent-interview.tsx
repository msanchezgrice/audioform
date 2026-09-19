"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AudioformWidget } from "@talkform/react";
import "@talkform/react/styles.css";
import {
  NEUTRAL_INTERVIEW_THEME,
  resolveEffectiveInterviewMode,
  resolveInterviewBranding,
  resolveInterviewTheme,
  type AudioformConfig,
  type AudioformFieldValue,
} from "@talkform/core";
import styles from "./respond.module.css";

function applyFavicon(href: string | undefined) {
  if (!href || typeof document === "undefined") return;
  const existing = document.querySelector<HTMLLinkElement>("link[data-respond-favicon='true']");
  const link = existing ?? document.createElement("link");
  link.rel = "icon";
  link.href = href;
  link.referrerPolicy = "no-referrer";
  link.dataset.respondFavicon = "true";
  if (!existing) document.head.appendChild(link);
}

export function RespondentInterview({ id, voiceEnabled }: { id: string; voiceEnabled: boolean }) {
  const [respondentToken, setRespondentToken] = useState("");
  const [config, setConfig] = useState<AudioformConfig | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [consented, setConsented] = useState(false);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [projectVoiceEligible, setProjectVoiceEligible] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    void Promise.resolve().then(async () => {
      if (abort.signal.aborted) return;
      const loadedToken = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      if (!loadedToken) {
        setLoadedId(id);
        setError("This link is missing its access token. Please open the complete link you were sent.");
        return;
      }
      try {
        const response = await fetch(`/api/v1/respond/${id}`, {
          headers: { "X-Talkform-Respondent-Token": loadedToken },
          cache: "no-store",
          signal: abort.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "This interview is unavailable or has expired.");
        if (!data.config) throw new Error("This interview could not be loaded.");
        if (abort.signal.aborted) return;
        setError("");
        setRespondentToken(loadedToken);
        setConfig(data.config);
        setProjectVoiceEligible(data.voiceEligible === true);
        setLoadedId(id);
        setConsented(false);
        setStarted(false);
        setSubmitted(data.status === "completed");
      } catch (e) {
        if (abort.signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
        setLoadedId(id);
        setError(e instanceof Error ? e.message : "This interview is unavailable or has expired.");
      }
    });
    return () => abort.abort();
  }, [id]);

  const branding = useMemo(() => resolveInterviewBranding(config?.branding), [config]);
  const theme = useMemo(() => resolveInterviewTheme(config?.theme, NEUTRAL_INTERVIEW_THEME), [config]);
  const voiceAvailable = voiceEnabled && resolveEffectiveInterviewMode({
    requested: config?.mode,
    voiceEligible: projectVoiceEligible,
  }) === "voice";

  useEffect(() => {
    if (!config) return;
    document.title = branding.fromName ? `${config.title} · ${branding.fromName}` : config.title;
    applyFavicon(branding.faviconUrl);
  }, [branding.faviconUrl, branding.fromName, config]);

  const pageStyle = {
    "--respond-accent": theme.accent,
    "--respond-surface": theme.surface,
    "--respond-panel": theme.panel,
    "--respond-ink": "#1c1917",
    "--respond-muted": "#6b6560",
    ...(branding.fontFamily ? { "--respond-font": branding.fontFamily } : {}),
  } as CSSProperties;

  if (loadedId !== id) {
    return (
      <main className={styles.page} style={pageStyle}>
        <div className={styles.center}>
          <section className={styles.letter}>
            <p className={styles.from}>Interview</p>
            <h1>Just a moment.</h1>
            <p className={styles.copy}>Loading the questions you were asked to answer.</p>
          </section>
        </div>
      </main>
    );
  }
  if (error) {
    return (
      <main className={styles.page} style={pageStyle}>
        <div className={styles.center}>
          <section className={styles.letter}>
            <p className={styles.from}>Interview</p>
            <h1>This link isn’t available.</h1>
            <p className={styles.alert} role="alert">{error}</p>
            <p className={styles.copy}>Ask the person who sent it for a new link. Links expire after 7 days.</p>
          </section>
        </div>
      </main>
    );
  }
  if (submitted) {
    return (
      <main className={styles.page} style={pageStyle}>
        <div className={styles.center}>
          <section className={styles.done}>
            <p className={styles.from}>{branding.fromName || "Interview"}</p>
            <h1>Answers sent.</h1>
            <p className={styles.copy}>You can close this page. The team that invited you can now read your reviewed answers.</p>
          </section>
        </div>
      </main>
    );
  }
  if (!config) {
    return <main className={styles.page} style={pageStyle}><div className={styles.center}><p className={styles.copy}>Loading your interview…</p></div></main>;
  }

  const from = branding.fromName || branding.wordmark;
  const purpose = branding.purpose || config.description;

  return (
    <main className={styles.page} style={pageStyle}>
      {!started ? (
        <div className={styles.center}>
          <section className={styles.letter}>
            <div className={styles.identity}>
              {branding.logoUrl ? <img className={styles.logo} src={branding.logoUrl} alt="" referrerPolicy="no-referrer" /> : null}
              {from ? <p className={styles.from}>From {from}</p> : <p className={styles.from}>Interview</p>}
              {purpose ? <p className={styles.purpose}>{purpose}</p> : null}
            </div>
            <h1>{config.title}</h1>
            {config.description && config.description !== purpose ? <p className={styles.copy}>{config.description}</p> : null}
            <p className={styles.mode}>
              {voiceAvailable
                ? "You can speak or type. Review every answer before you send it."
                : "This is a written interview. Review every answer before you send it."}
            </p>
            <label className={styles.consent}>
              <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
              I understand who will receive my answers and agree to continue.
            </label>
            <button className={styles.start} disabled={!consented} onClick={() => setStarted(true)} data-testid="respondent-consent">
              Start
            </button>
            {branding.showPoweredBy ? <p className={styles.powered}>Interview hosted privately</p> : null}
          </section>
        </div>
      ) : (
        <div className={styles.session}>
          <AudioformWidget
            config={config}
            voiceEnabled={voiceAvailable}
            parseReply={async ({ field, reply }) => {
              const response = await fetch(`/api/v1/respond/${id}/parse`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Talkform-Respondent-Token": respondentToken,
                },
                body: JSON.stringify({ fieldId: field.id, reply }),
              });
              const data = await response.json() as { ok?: boolean; value?: unknown; error?: string | { message?: string } };
              if (!response.ok || data.ok !== true) {
                const message = typeof data.error === "string" ? data.error : data.error?.message;
                return { ok: false, error: message || "We could not understand that. Try again in your own words." };
              }
              return { ok: true, value: data.value as AudioformFieldValue };
            }}
            realtimeHeaders={{ "X-Talkform-Respondent-Token": respondentToken, "X-Talkform-Handoff-Id": id }}
            onComplete={async (result, context) => {
              const response = await fetch(`/api/v1/respond/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Talkform-Respondent-Token": respondentToken },
                body: JSON.stringify({ values: result.fields, mode: context.mode }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Your answers could not be submitted. Please try again.");
              setSubmitted(true);
            }}
          />
        </div>
      )}
    </main>
  );
}
