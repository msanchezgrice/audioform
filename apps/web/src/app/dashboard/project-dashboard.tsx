"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./workspace.module.css";

type Project = { id: string; name: string; environment: string };
type Key = { id: string; name: string; prefix?: string; lastUsedAt?: string; revokedAt?: string };
type Handoff = { id: string; status: string; createdAt?: string };
type Detail = { project: Project; keys: Key[]; recentHandoffs: Handoff[]; counts: Record<string, number>; handoffsCreatedToday: number };
const example = { id: "project-brief", title: "Tell us about your project", fields: [{ id: "name", label: "Your name", type: "text", required: true, promptTitle: "Your name", promptDetail: "Ask what name they use." }, { id: "goal", label: "What would you like to accomplish?", type: "long_text", required: true, promptTitle: "Your goal", promptDetail: "Ask what they want to accomplish." }] };
const statLabels: Record<string, string> = { createdToday: "Created today", pending: "Awaiting response", completed: "Submitted", expired: "Expired", deleted: "Deleted" };
const statusLabels: Record<string, string> = { created: "Link created", open: "Awaiting response", pending: "Awaiting response", submitted: "Submitted", completed: "Submitted", deleted: "Deleted", expired: "Expired" };

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(typeof data.error === "string" ? data.error : data.error?.message || "The request failed. Please try again.", response.status, data.error?.code);
  return data;
}

function formatStatus(status: string) {
  return statusLabels[status.toLowerCase()] ?? status.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ProjectDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [secret, setSecret] = useState("");
  const [claimKey, setClaimKey] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
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
  async function act(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }

  async function claimAgentWorkspace() {
    setError("");
    setClaimMessage("");
    const projectKey = claimKey.trim();
    if (!projectKey) {
      setError("Enter the existing machine project key to connect its workspace.");
      return;
    }
    setBusy(true);
    try {
      const data = await api("/api/v1/agents/claim", {
        method: "POST",
        headers: { Authorization: `Bearer ${projectKey}` },
        body: "{}",
      });
      setClaimKey("");
      setClaimMessage("Agent workspace connected. Voice is now available within the workspace limits.");
      await refresh();
      if (data.project?.id) setSelected(data.project.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/sign-in?redirect_url=/dashboard");
        return;
      }
      if (e instanceof ApiError && e.status === 403 && e.code === "verified_account_required") {
        setError("Verify your account email in Clerk before connecting an agent workspace.");
        return;
      }
      setError(e instanceof Error ? e.message : "Unable to connect this agent workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div><p className={styles.kicker}>Developer workspace</p><h1>Build a handoff</h1><p className={styles.introCopy}>Create a project, share one respondent link, and retrieve reviewed answers as JSON.</p></div>
        <div className={styles.headerLinks}><Link href="/docs/http-api">HTTP API</Link><Link href="/docs/mcp">MCP</Link></div>
      </header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.grid}>
        <aside className={styles.projectRail} aria-label="Projects">
          <div className={styles.railHeading}><h2>Projects</h2><span>{projects.length}/5</span></div>
          <div className={styles.projects}>{projects.map((project) => <button key={project.id} disabled={busy} aria-pressed={selected === project.id} onClick={() => setSelected(project.id)}><span>{project.name}</span><small>{project.environment}</small></button>)}</div>
          <form className={styles.createProject} data-agent-form="create-project" onSubmit={(event) => { event.preventDefault(); void act(async () => { const data = await api("/api/v1/projects", { method: "POST", body: JSON.stringify({ name, environment }) }); setName(""); await refresh(); setSelected(data.project.id); }); }}>
            <h3>New project</h3>
            <label>Project name<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="My agent" /></label>
            <label>Environment<select value={environment} onChange={(e) => setEnvironment(e.target.value)}><option value="production">Production</option><option value="test">Test</option></select></label>
            <button className={styles.primary} disabled={busy || projects.length >= 5} data-testid="create-project">Create project</button>
          </form>
          <details className={styles.claimWorkspace}>
            <summary>Connect an agent workspace</summary>
            <p>Already have a machine project key? Connect that workspace to this verified account to manage it here.</p>
            <form onSubmit={(event) => { event.preventDefault(); void claimAgentWorkspace(); }}>
              <label className="ph-no-capture">Machine project key<input className="ph-no-capture" type="password" name="agent-project-key" autoComplete="new-password" value={claimKey} onChange={(event) => setClaimKey(event.target.value)} placeholder="tfk_…" spellCheck={false} /></label>
              <button className={styles.primary} type="submit" disabled={busy}>Connect workspace</button>
            </form>
            {claimMessage && <p className={styles.claimMessage} role="status">{claimMessage}</p>}
          </details>
          <p className={styles.railNote}>100 hosted text handoffs per day per project. Voice uses shared limits.</p>
        </aside>
        <div className={styles.contentColumn}>
          {detail ? <>
            <section className={`${styles.panel} ${styles.projectSummary}`}>
              <div><p className={styles.sectionLabel}>Selected project</p><h2>{detail.project.name}</h2><p className={styles.muted}><code>{detail.project.id}</code> <span aria-hidden="true">·</span> {detail.project.environment}</p></div>
              {detail.counts && <div className={styles.stats} aria-label="Project activity">{Object.entries({ createdToday: detail.handoffsCreatedToday, ...detail.counts }).map(([label, value]) => <div key={label}><strong>{value}</strong><span>{statLabels[label] ?? label.replace(/([A-Z])/g, " $1")}</span></div>)}</div>}
            </section>
            <div className={styles.actionGrid}>
              <section className={`${styles.panel} ${styles.handoffPanel}`}>
                <div className={styles.panelHeading}><div><p className={styles.sectionLabel}>Share a form</p><h2>Create a respondent link</h2></div><span className={styles.badge}>7 days</span></div>
                <p className={styles.muted}>Paste a config, create a private link, and let the respondent review before submitting.</p>
                <label>Form configuration<textarea rows={8} value={draft} onChange={(e) => { handoffIdempotencyKeyRef.current = null; setDraft(e.target.value); }} spellCheck={false} /></label>
                <button className={styles.primary} disabled={busy} data-testid="create-handoff" onClick={() => void act(async () => { const idempotencyKey = handoffIdempotencyKeyRef.current ?? crypto.randomUUID(); handoffIdempotencyKeyRef.current = idempotencyKey; const data = await api(`/api/v1/projects/${selected}/handoffs`, { method: "POST", body: JSON.stringify({ config: JSON.parse(draft), idempotencyKey }) }); handoffIdempotencyKeyRef.current = null; setInvite(data.respondentUrl); await refreshDetail(); })}>Create respondent link</button>
                <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{invite ? "Respondent link created. It is ready to copy or open." : ""}</p>
                {invite && <div className={styles.success}><strong>Link ready to share</strong><p className={styles.muted}>The respondent reviews and submits their answers before the result is available.</p><code className={styles.code}>{invite}</code><div className={styles.row}><button onClick={() => void act(async () => navigator.clipboard.writeText(invite))}>Copy link</button><a href={invite} target="_blank" rel="noreferrer">Open interview ↗</a></div></div>}
              </section>
              <section className={`${styles.panel} ${styles.keyPanel}`}>
                <div className={styles.panelHeading}><div><p className={styles.sectionLabel}>Machine access</p><h2>API keys</h2></div><button disabled={busy} data-testid="create-api-key" onClick={() => void act(async () => { const data = await api(`/api/v1/projects/${selected}/keys`, { method: "POST", body: JSON.stringify({ name: "Agent key" }) }); setSecret(data.secret); await refreshDetail(); })}>Create key</button></div>
                <p className={styles.muted}>Keys are shown once. Keep them in your server or agent process.</p>
                <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{secret ? "API key created. Save it now; its value is shown below." : ""}</p>
                {secret && <div className={styles.success}><strong>Save this key now</strong><code className={styles.code}>{secret}</code><div className={styles.row}><button onClick={() => void act(async () => navigator.clipboard.writeText(secret))}>Copy key</button><button onClick={() => setSecret("")}>Hide key</button></div></div>}
                <div className={styles.keyList}>{detail.keys.map((key) => <div className={styles.keyRow} key={key.id}><span><strong>{key.name}</strong><small><code>{key.prefix}</code>{key.lastUsedAt ? ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : " · Not used yet"}</small></span>{!key.revokedAt && <button disabled={busy} data-agent-danger="revoke-key" data-agent-confirm="required" onClick={() => { if (window.confirm("Revoke this key? Agents using it will lose access.")) void act(async () => { await api(`/api/v1/projects/${selected}/keys/${key.id}`, { method: "DELETE" }); await refreshDetail(); }); }}>Revoke</button>}</div>)}</div>
                {!detail.keys.length && <p className={styles.emptyNote}>Create a key when your server is ready to connect.</p>}
              </section>
            </div>
            <section className={`${styles.panel} ${styles.recentPanel}`}>
              <div className={styles.panelHeading}><div><p className={styles.sectionLabel}>Activity</p><h2>Recent handoffs</h2></div><button onClick={() => void act(refreshDetail)}>Refresh</button></div>
              {detail.recentHandoffs.length ? <div className={styles.handoffList}>{detail.recentHandoffs.map((handoff) => <div className={styles.handoffRow} key={handoff.id}><span><code>{handoff.id}</code>{handoff.createdAt && <small>{new Date(handoff.createdAt).toLocaleDateString()}</small>}</span><span className={styles.status}>{formatStatus(handoff.status)}</span></div>)}</div> : <p className={styles.muted}>Your first respondent link will appear here.</p>}
            </section>
          </> : <section className={`${styles.panel} ${styles.emptyState}`}><p className={styles.sectionLabel}>Start here</p><h2>{selected ? "Loading project…" : "Create your first project"}</h2><p className={styles.muted}>A project keeps your API keys, handoff links, and usage together. Use the project rail to begin.</p></section>}
        </div>
      </div>
    </main>
  );
}
