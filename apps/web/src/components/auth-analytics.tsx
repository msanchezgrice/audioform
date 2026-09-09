"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

let signupStartedAt: number | null = null;
const recordedSignupUsers = new Set<string>();

function emit(event: string, properties: Record<string, string | number | boolean> = {}) {
  window.dispatchEvent(new CustomEvent("talkform:event", { detail: { event, properties } }));
}

export function SignupFlowTracker() {
  useEffect(() => {
    signupStartedAt = Date.now();
    emit("signup_started", { source: "clerk_signup" });
  }, []);
  return null;
}

export function AuthAnalytics() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    window.dispatchEvent(new CustomEvent("talkform:identify", { detail: { userId: user.id } }));

    const alreadyRecorded = recordedSignupUsers.has(user.id);
    if (signupStartedAt !== null && Date.now() - signupStartedAt < 24 * 60 * 60 * 1_000 && !alreadyRecorded) {
      emit("signup_completed", { source: "clerk_signup" });
      recordedSignupUsers.add(user.id);
      signupStartedAt = null;
    }
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}
