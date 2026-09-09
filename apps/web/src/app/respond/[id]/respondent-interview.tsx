"use client";
import { useEffect, useRef, useState } from "react";
import { AudioformWidget } from "@talkform/react";
import "@talkform/react/styles.css";
import type { AudioformConfig } from "@talkform/core";
import styles from "../../dashboard/workspace.module.css";

export function RespondentInterview({ id, voiceEnabled }: { id: string; voiceEnabled: boolean }) {
  const token = useRef("");
  const [config, setConfig] = useState<AudioformConfig | null>(null);
  const [error, setError] = useState("");
  const [consented, setConsented] = useState(false);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (!token.current) { setError("This link is missing its access token. Please open the complete link you were sent."); return; }
    const abort = new AbortController();
    void fetch(`/api/v1/respond/${id}`, { headers: { "X-Talkform-Respondent-Token": token.current }, cache: "no-store", signal: abort.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "This interview is unavailable or has expired.");
      if (!data.config) throw new Error("This interview could not be loaded.");
      setConfig(data.config);
      if (data.status === "completed") setSubmitted(true);
    }).catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); });
    return () => abort.abort();
  }, [id]);
  if (submitted) return <main className={styles.workspace}><div className={styles.success}><h1>Answers submitted.</h1><p>The project that invited you can now retrieve your reviewed answers. You can close this page.</p></div></main>;
  if (error) return <main className={styles.workspace}><div className={styles.error} role="alert">{error}</div></main>;
  if (!config) return <main className={styles.workspace}><p>Loading your interview…</p></main>;
  return <main className={styles.invite}>{!started ? <section className={styles.panel}><span className={styles.eyebrow}>You have been invited</span><h1>{config.title}</h1><p className={styles.muted}>Answer at your own pace, then review the form. Your answers stay in this browser until you choose “Submit reviewed answers.” The project that sent you this link can then retrieve them for 7 days.</p><p className={styles.muted}>The submitted result contains structured answers, without the conversation transcript. {voiceEnabled ? "Optional voice mode sends audio to OpenAI to run the conversation. Text mode is always available." : "You can complete this interview in text mode."}</p><label className={styles.consent}><input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />I understand who will receive my answers and agree to continue.</label><button className={styles.primary} disabled={!consented} onClick={() => setStarted(true)} data-testid="respondent-consent">Start interview</button></section> : <AudioformWidget config={config} voiceEnabled={voiceEnabled} realtimeHeaders={{ "X-Talkform-Respondent-Token": token.current, "X-Talkform-Handoff-Id": id }} onComplete={async (result, context) => {
    const response = await fetch(`/api/v1/respond/${id}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Talkform-Respondent-Token": token.current }, body: JSON.stringify({ values: result.fields, mode: context.mode }) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Your answers could not be submitted. Please try again.");
    setSubmitted(true);
  }} />}</main>;
}
