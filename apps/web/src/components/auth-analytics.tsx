"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const SIGNUP_STARTED_AT = "talkform_signup_started_at";
const SIGNUP_COMPLETED_USER = "talkform_signup_completed_user";

function emit(event: string, properties: Record<string, string | number | boolean> = {}) {
  window.dispatchEvent(new CustomEvent("talkform:event", { detail: { event, properties } }));
}

export function SignupFlowTracker() {
  useEffect(() => {
    sessionStorage.setItem(SIGNUP_STARTED_AT, String(Date.now()));
    emit("signup_started", { source: "clerk_signup" });
  }, []);
  return null;
}

export function AuthAnalytics() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    window.dispatchEvent(new CustomEvent("talkform:identify", { detail: { userId: user.id } }));

    const startedAt = Number(sessionStorage.getItem(SIGNUP_STARTED_AT));
    const alreadyRecorded = localStorage.getItem(SIGNUP_COMPLETED_USER) === user.id;
    if (Number.isFinite(startedAt) && Date.now() - startedAt < 24 * 60 * 60 * 1_000 && !alreadyRecorded) {
      emit("signup_completed", { source: "clerk_signup" });
      localStorage.setItem(SIGNUP_COMPLETED_USER, user.id);
      sessionStorage.removeItem(SIGNUP_STARTED_AT);
    }
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}
