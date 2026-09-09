"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./workspace.module.css";

type Project = { id: string; name: string; environment: string };
type Key = { id: string; name: string; prefix?: string; lastUsedAt?: string; revokedAt?: string };
type Handoff = { id: string; status: string; createdAt?: string };
type Detail = { project: Project; keys: Key[]; recentHandoffs: Handoff[]; counts: Record<string, number>; handoffsCreatedToday: number };
const example = { id: "project-brief", title: "Tell us about your project", fields: [{ id: "name", label: "Your name", type: "text", required: true, promptTitle: "Your name", promptDetail: "Ask what name they use." }, { id: "goal", label: "What would you like to accomplish?", type: "long_text", required: true, promptTitle: "Your goal", promptDetail: "Ask what they want to accomplish." }] };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "The request failed. Please try again.");
  return data;
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [secret, setSecret] = useState("");
  const [draft, setDraft] = useState(JSON.stringify(example, null, 2));
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const detailRequestRef = useRef(0);
  const handoffIdempotencyKeyRef = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const data = await api("/api/v1/projects");
    setProjects(data.projects);
    setSelected((current) => current || data.projects[0]?.id || "");
  }, []);
  useEffect(() => { void refresh().catch((e: Error) => setError(e.message)); }, [refresh]);
  const refreshDetail = useCallback(async () => {
    if (!selected) return;
    const requestId = ++detailRequestRef.current;
    const projectId = selected;
    const data = await api(`/api/v1/projects/${selected}`);
    if (requestId !== detailRequestRef.current || projectId !== selected) return;
    setDetail(data);
  }, [selected]);
  useEffect(() => {
    let active = true;
    setSecret("");
    setInvite("");
    setDetail(null);
    void refreshDetail().catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [refreshDetail]);
  async function act(action: () => Promise<void>) { setError(""); setBusy(true); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } }
  return <main className={styles.workspace}>
    <div className={styles.intro}><span className={styles.eyebrow}>Free developer workspace</span><h1>A form for your agent.<br />A conversation for your user.</h1><p>Create a project, issue a key, and send a respondent link. Your agent can retrieve the reviewed answers as JSON. No card required.</p><Link href="/docs/http-api">API guide</Link> · <Link href="/docs/mcp">MCP guide</Link></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.grid}><aside className={styles.panel}><h2>Your projects</h2><div className={styles.projects}>{projects.map((project) => <button key={project.id} disabled={busy} aria-pressed={selected === project.id} onClick={() => setSelected(project.id)}>{project.name}<small className={styles.muted}> · {project.environment}</small></button>)}</div>
      <form data-agent-form="create-project" onSubmit={(event) => { event.preventDefault(); void act(async () => { const data = await api("/api/v1/projects", { method: "POST", body: JSON.stringify({ name, environment }) }); setName(""); await refresh(); setSelected(data.project.id); }); }}>
        <label>Project name<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="My agent" /></label>
        <label>Environment<select value={environment} onChange={(e) => setEnvironment(e.target.value)}><option value="production">Production</option><option value="test">Test</option></select></label>
        <button className={styles.primary} disabled={busy} data-testid="create-project">Create project</button>
      </form><p className={styles.muted}>Up to 5 projects. Each project can create up to 100 hosted handoffs per day. Voice interviews also use shared voice limits.</p>
    </aside><div>{detail ? <>
      <section className={styles.panel}><h2>{detail.project.name}</h2><p className={styles.muted}>Project <code>{detail.project.id}</code> · {detail.project.environment}</p>
        {detail.counts && <div className={styles.stats}>{Object.entries({ createdToday: detail.handoffsCreatedToday, ...detail.counts }).map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label.replace(/([A-Z])/g, " $1")}</span></div>)}</div>}
      </section>
      <section className={styles.panel}><div className={styles.row}><h2>API keys</h2><button disabled={busy} data-testid="create-api-key" onClick={() => void act(async () => { const data = await api(`/api/v1/projects/${selected}/keys`, { method: "POST", body: JSON.stringify({ name: "Agent key" }) }); setSecret(data.secret); await refreshDetail(); })}>Create key</button></div>
        <p className={styles.muted}>Use a key as a Bearer token. Each secret is shown once. Keep it on your server.</p>
        {secret && <div className={styles.success}><strong>Save this key now.</strong><code className={styles.code}>{secret}</code><div className={styles.row}><button onClick={() => void act(async () => navigator.clipboard.writeText(secret))}>Copy key</button><button onClick={() => setSecret("")}>Hide key</button></div></div>}
        {detail.keys.map((key) => <div className={styles.row} key={key.id}><span>{key.name} <code>{key.prefix}</code><small className={styles.muted}>{key.lastUsedAt ? ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : " · Not used yet"}</small></span>{!key.revokedAt && <button disabled={busy} data-agent-danger="revoke-key" data-agent-confirm="required" onClick={() => { if (window.confirm("Revoke this key? Agents using it will lose access.")) void act(async () => { await api(`/api/v1/projects/${selected}/keys/${key.id}`, { method: "DELETE" }); await refreshDetail(); }); }}>Revoke</button>}</div>)}
      </section>
      <section className={styles.panel}><h2>Create your first handoff</h2><p className={styles.muted}>Start with this example or paste a Talkform config. The respondent link expires after 7 days. Submitted answers are available for 7 days.</p>
        <label>Form configuration<textarea rows={15} value={draft} onChange={(e) => { handoffIdempotencyKeyRef.current = null; setDraft(e.target.value); }} spellCheck={false} /></label>
        <button className={styles.primary} disabled={busy} data-testid="create-handoff" onClick={() => void act(async () => { const idempotencyKey = handoffIdempotencyKeyRef.current ?? crypto.randomUUID(); handoffIdempotencyKeyRef.current = idempotencyKey; const data = await api(`/api/v1/projects/${selected}/handoffs`, { method: "POST", body: JSON.stringify({ config: JSON.parse(draft), idempotencyKey }) }); handoffIdempotencyKeyRef.current = null; setInvite(data.respondentUrl); await refreshDetail(); })}>Create respondent link</button>
        {invite && <div className={styles.success}><p>Share this private link with your respondent.</p><code className={styles.code}>{invite}</code><div className={styles.row}><button onClick={() => void act(async () => navigator.clipboard.writeText(invite))}>Copy link</button><a href={invite} target="_blank" rel="noreferrer">Open interview ↗</a></div></div>}
      </section>
      <section className={styles.panel}><div className={styles.row}><h2>Recent handoffs</h2><button onClick={() => void act(refreshDetail)}>Refresh</button></div>{detail.recentHandoffs.length ? detail.recentHandoffs.map((handoff) => <div className={styles.row} key={handoff.id}><code>{handoff.id}</code><span>{handoff.status}</span></div>) : <p className={styles.muted}>Your first handoff will appear here.</p>}</section>
    </> : <section className={styles.panel}><h2>{selected ? "Loading project…" : "Create a project to get started"}</h2><p className={styles.muted}>Project keys connect usage and results to your integration. Test projects stay separate in the usage report.</p></section>}</div></div>
  </main>;
}
