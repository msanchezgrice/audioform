"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { emitTalkformEvent } from "@talkform/react";
import styles from "./pilot.module.css";

type PilotFormProps = {
  initialFormUrl?: string;
  source?: string;
  checkoutCancelled?: boolean;
};

type PilotRequestResponse = {
  ok?: boolean;
  requestId?: string;
  checkoutAvailable?: boolean;
  error?: string;
};

type PilotCheckoutResponse = {
  url?: string;
  error?: string;
};

export function PilotForm({
  initialFormUrl = "",
  source = "pilot_page",
  checkoutCancelled = false,
}: PilotFormProps) {
  const started = useRef(false);
  const [pending, setPending] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);

  function recordStarted() {
    if (started.current) return;
    started.current = true;
    emitTalkformEvent("pilot_form_started", {
      source,
      plan: "guided_pilot",
    });
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          useCase: form.get("useCase"),
          formUrl: form.get("formUrl"),
          source,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as PilotRequestResponse;
      if (!response.ok || !payload.ok || !payload.requestId) {
        throw new Error(payload.error || "We could not save that request. Please review the fields and try again.");
      }

      setRequestId(payload.requestId);
      setCheckoutAvailable(payload.checkoutAvailable === true);
      emitTalkformEvent("pilot_request_submitted", {
        source,
        plan: "guided_pilot",
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not save that request.");
    } finally {
      setPending(false);
    }
  }

  async function openCheckout() {
    if (!requestId || !checkoutAvailable) return;
    setCheckoutPending(true);
    setError("");
    emitTalkformEvent("checkout_started", {
      source,
      plan: "guided_pilot",
      destination: "stripe",
    });

    try {
      const response = await fetch("/api/pilot/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const payload = (await response.json().catch(() => ({}))) as PilotCheckoutResponse;
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Secure checkout is not available for this request yet.");
      }
      window.location.assign(payload.url);
    } catch (checkoutError) {
      emitTalkformEvent("checkout_failed", {
        source,
        plan: "guided_pilot",
        stage: "create_session",
      });
      setError(checkoutError instanceof Error ? checkoutError.message : "Secure checkout is unavailable.");
      setCheckoutPending(false);
    }
  }

  if (requestId) {
    return (
      <section className={styles.formCard} aria-live="polite">
        <span className={styles.eyebrow}>Request received</span>
        <h2>We have the workflow context.</h2>
        <p>
          We&apos;ll review the form and confirm the measurable pilot plan. Your form is not submitted to its source site.
        </p>
        {checkoutAvailable ? (
          <>
            <p>
              This request is eligible for secure one-time payment. Stripe shows the exact amount before you pay; this does not start a subscription.
            </p>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={openCheckout}
              disabled={checkoutPending}
              data-agent-action="pay-guided-pilot"
            >
              {checkoutPending ? "Opening secure checkout…" : "Continue to secure payment"}
            </button>
          </>
        ) : (
          <p className={styles.statusNote}>
            Payment is not available for this request yet. We&apos;ll confirm scope before sending a payment link.
          </p>
        )}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <Link href="/import" className={styles.textLink}>Convert another form</Link>
      </section>
    );
  }

  return (
    <form
      className={styles.formCard}
      onSubmit={submitRequest}
      onFocusCapture={recordStarted}
      data-agent-form="pilot-request"
      data-testid="pilot-request-form"
    >
      <span className={styles.eyebrow}>Request a measured pilot</span>
      <h2>Tell us where this interview needs to work.</h2>
      <p>We use these details only to review the requested workflow and respond about the pilot.</p>

      {checkoutCancelled ? (
        <p className={styles.statusNote}>Checkout was cancelled. Nothing was charged; you can submit or revise the request below.</p>
      ) : null}

      <label className={styles.field}>
        <span>Business email</span>
        <input name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      </label>
      <label className={styles.field}>
        <span>What should this workflow accomplish?</span>
        <textarea
          name="useCase"
          rows={5}
          minLength={20}
          maxLength={2_000}
          required
          placeholder="For example: collect complete customer-discovery answers and export a reviewed JSON record to our research workflow."
        />
      </label>
      <label className={styles.field}>
        <span>Public form URL <small>optional</small></span>
        <input name="formUrl" type="url" defaultValue={initialFormUrl} placeholder="https://form.typeform.com/to/…" />
      </label>

      <button
        type="submit"
        className={styles.primaryAction}
        disabled={pending}
        data-agent-action="submit-pilot-request"
      >
        {pending ? "Saving request…" : "Request the guided pilot"}
      </button>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <p className={styles.finePrint}>
        Submitting is not a purchase. If checkout is available, Stripe will show the exact one-time price before payment.
      </p>
    </form>
  );
}
