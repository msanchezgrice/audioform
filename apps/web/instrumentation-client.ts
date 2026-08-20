import posthog from "posthog-js";
import {
  dispatchAnalyticsEvent,
  searchAttributionFromUrl,
  telemetryAllowed,
} from "./src/lib/analytics-client";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const analyticsEnabled = telemetryAllowed(
  navigator.doNotTrack,
  (window as Window & { doNotTrack?: string | null }).doNotTrack,
);
const ga4Capture = (event: string, properties: Record<string, string | number | boolean>) => {
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.("event", event, { ...properties, site_id: "talkform.ai" });
};

if (analyticsEnabled && token) {
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    defaults: "2026-05-30",
    capture_exceptions: true,
    respect_dnt: true,
    debug: process.env.NODE_ENV === "development",
  });
  posthog.register({ site_id: "talkform.ai", site_name: "Talkform" });

  const attribution = searchAttributionFromUrl(new URL(window.location.href), document.referrer);
  posthog.register({
    landing_path: attribution.landingPath,
    referrer_host: attribution.referrerHost,
    acquisition_source: attribution.source,
    acquisition_medium: attribution.medium,
    acquisition_campaign: attribution.campaign,
  });
  if (attribution.source) {
    posthog.capture("search_landing", attribution);
    ga4Capture("search_landing", attribution);
  }

  const marketingVideoEvents = {
    played: "marketing_video_played",
    progress: "marketing_video_progress",
    completed: "marketing_video_completed",
  } as const;

  window.addEventListener("talkform:marketing-video", (event) => {
    if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== "object") return;
    const { action, videoId, milestone } = event.detail as {
      action?: string;
      videoId?: string;
      milestone?: number;
    };
    if (!videoId || !action || !(action in marketingVideoEvents)) return;

    posthog.capture(marketingVideoEvents[action as keyof typeof marketingVideoEvents], {
      video_id: videoId,
      ...(action === "progress" && [25, 50, 75].includes(milestone ?? 0)
        ? { milestone }
        : {}),
    });
  });
}

if (analyticsEnabled) {
  window.addEventListener("talkform:event", (event) => {
    dispatchAnalyticsEvent((event as CustomEvent<unknown>).detail, {
      posthog: token ? (name, properties) => posthog.capture(name, properties) : undefined,
      ga4: ga4Capture,
    });
  });
}
