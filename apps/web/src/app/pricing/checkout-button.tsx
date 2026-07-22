"use client";

import { useState } from "react";
import { emitTalkformEvent } from "@talkform/react";

export function CheckoutButton({ className }: { className?: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function startCheckout() {
    setPending(true);
    setError("");
    emitTalkformEvent("checkout_started", { plan: "pro", destination: "stripe" });
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval: "month" }),
      });
      if (response.status === 401) {
        window.location.assign("/sign-in?redirect_url=/pricing");
        return;
      }
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Checkout is unavailable.");
      window.location.assign(payload.url);
    } catch (checkoutError) {
      emitTalkformEvent("checkout_failed", { plan: "pro", stage: "create_session" });
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout is unavailable.");
      setPending(false);
    }
  }

  return <div>
    <button type="button" className={className} onClick={startCheckout} disabled={pending} data-agent-action="start-pro">
      {pending ? "Opening secure checkout…" : "Start Pro"}
    </button>
    {error ? <p role="alert">{error} Email support@talkform.ai to join the pilot.</p> : null}
  </div>;
}
