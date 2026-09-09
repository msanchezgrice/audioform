import Link from "next/link";
import { redirect } from "next/navigation";
import { getOperatorUsage, requireOperator } from "@/lib/platform/operator";
import { PlatformError } from "@/lib/platform/types";
import styles from "../workspace.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Operator usage", robots: { index: false, follow: false } };
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value / 1_000_000);
export default async function UsagePage() {
  let userId: string;
  try { userId = await requireOperator(); } catch (error) {
    if (error instanceof PlatformError && error.status === 401) redirect("/sign-in?redirect_url=/dashboard/usage");
    return <main className={styles.workspace}><h1>Operator access required</h1><p>This report is restricted to the Talkform operator.</p><Link href="/dashboard">Back to your projects</Link></main>;
  }
  const data = await getOperatorUsage(userId);
  return <main className={styles.workspace}><div className={styles.intro}><span className={styles.eyebrow}>Talkform operator</span><h1>Are agents coming back?</h1><p>Last 30 days, UTC. Activation means a project retrieved a submitted result. Repeat use means retrievals on at least two different days. Counts below exclude your internal projects and test projects.</p><Link href="/dashboard">Your workspace</Link> · <a href="/dashboard/usage">Refresh</a></div>
    <section className={styles.panel}><h2>Integration funnel</h2><div className={styles.stats}>{Object.entries(data.summary).map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label.replace(/([A-Z])/g, " $1")}</span></div>)}</div><p className={styles.muted}>Retrieval confirms that Talkform served the JSON; it does not confirm what the receiving agent did next.</p></section>
    <section className={styles.panel}><h2>AI cost controls</h2><div className={styles.stats}><div><strong>{usd(data.cost.daily_provider_estimate)}</strong>Today’s provider usage estimate</div><div><strong>{usd(data.cost.daily_reserved_exposure)}</strong>Today’s charged or reserved exposure</div><div><strong>{usd(data.cost.monthly_reserved_exposure)}</strong>Month exposure / {usd(data.policy.monthlyLimitMicrousd)} limit</div></div><p>Daily reservation limit: {usd(data.policy.dailyLimitMicrousd)}. Active voice sessions: {data.cost.active_realtime}. Unresolved terminations: {data.cost.termination_unknown}.</p><p className={styles.muted}>Estimates use observed provider tokens and a rate card. They are not invoices. Reservations prevent new AI sessions when the shared budget is exhausted; text interviews continue.</p></section>
    <section className={styles.panel}><h2>Projects</h2><p className={styles.muted}>Showing up to {data.projectLimit} newest projects. Account IDs identify signed-in developers; form answers and respondent identities are excluded.</p><div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left", borderSpacing: "16px" }}><thead><tr><th>Project / account</th><th>Kind</th><th>Created</th><th>Submitted</th><th>Retrieved</th><th>Active keys</th><th>Last API use</th></tr></thead><tbody>{data.projects.map((p) => <tr key={p.id}><td>{p.name}<small className={styles.muted} style={{ display: "block" }}>{p.account_id}</small></td><td>{p.internal ? "internal" : p.environment}</td><td>{p.created}</td><td>{p.completed}</td><td>{p.retrieved}</td><td>{p.active_keys}</td><td>{p.last_used_at ? new Date(p.last_used_at).toLocaleDateString("en-US", { timeZone: "UTC" }) : "Never"}</td></tr>)}</tbody></table></div></section>
    <p className={styles.muted}>This report uses Talkform’s operational database. Updated {new Date(data.generatedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC.</p>
  </main>;
}
