"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function openPortal() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      if (response.status === 401) {
        window.location.assign("/sign-in?redirect_url=/billing/success");
        return;
      }
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Billing management is unavailable.");
      window.location.assign(payload.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Billing management is unavailable.");
      setPending(false);
    }
  }

  return <div>
    <button type="button" onClick={openPortal} disabled={pending}>
      {pending ? "Opening billing…" : "Manage billing"}
    </button>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
