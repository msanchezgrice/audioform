/** Analytics classification only. These flags never grant access or change quotas. */
export type QaAttribution = {
  qa_traffic?: true;
  is_internal?: true;
  is_test?: true;
  pb_traffic_type?: "qa";
  pb_qa_run?: string;
  pb_qa_suite?: string;
  pb_qa_worker?: string;
};

const QA_USER_IDS = ["user_3LIDRoRVi4IE9PUeVQpcRdm8qW9"];
const FLAGS = { qa_traffic: true, is_internal: true, is_test: true, pb_traffic_type: "qa" } as const;
const STORAGE_KEY = "talkform:qa-attribution:v1";
const WORKERS = new Set(["macbook-pro", "mac-mini", "agent-box", "grok-virtual"]);

export function internalAnalyticsUserIds(extra = ""): string[] {
  return [...new Set([...QA_USER_IDS, ...extra.split(",").map(value => value.trim()).filter(Boolean)])];
}

export function qaAttributionFromUrl(value: string): QaAttribution {
  try {
    const params = new URL(value).searchParams;
    const explicit = params.get("pb_traffic_type") === "qa" ||
      ["1", "true"].includes(params.get("internal_qa") ?? params.get("qa") ?? "") ||
      params.get("utm_source") === "portfolio_brain_qa" || params.get("utm_medium") === "agent_qa";
    if (!explicit) return {};
    const result: QaAttribution = { ...FLAGS };
    for (const key of ["pb_qa_run", "pb_qa_suite"] as const) {
      const field = params.get(key);
      if (field && /^[a-z0-9_-]{1,100}$/i.test(field)) result[key] = field;
    }
    const worker = params.get("pb_qa_worker");
    if (worker && WORKERS.has(worker)) result.pb_qa_worker = worker;
    return result;
  } catch { return {}; }
}

/** Preserve only safe QA metadata across same-tab navigation, never the original URL. */
export function rememberQaAttribution(
  url: string,
  storage?: Pick<Storage, "getItem" | "setItem">,
  userId?: string,
): QaAttribution {
  let prior: QaAttribution = {};
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    if (stored?.qa_traffic === true) {
      const params = new URLSearchParams({ pb_traffic_type: "qa" });
      for (const key of ["pb_qa_run", "pb_qa_suite", "pb_qa_worker"]) {
        if (typeof stored[key] === "string") params.set(key, stored[key]);
      }
      prior = qaAttributionFromUrl(`https://talkform.ai/?${params}`);
    }
  } catch { /* Storage can be unavailable under browser privacy settings. */ }
  const result = { ...prior, ...qaAttributionFromUrl(url), ...(userId && QA_USER_IDS.includes(userId) ? FLAGS : {}) };
  if (result.qa_traffic) {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(result)); } catch { /* fail soft */ }
  }
  return result;
}
