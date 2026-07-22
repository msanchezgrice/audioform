import posthog from "posthog-js";
import { analyticsEventFromCustomEvent, searchAttributionFromUrl } from "./src/lib/analytics-client";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

if (token) {
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    defaults: "2026-05-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
  posthog.register({ site_id: "talkform.ai", site_name: "Talkform" });

  window.addEventListener("talkform:event", (event) => {
    const safeEvent = analyticsEventFromCustomEvent((event as CustomEvent<unknown>).detail);
    if (safeEvent) posthog.capture(safeEvent.event, safeEvent.properties);
  });

  const attribution = searchAttributionFromUrl(new URL(window.location.href), document.referrer);
  posthog.register({
    landing_path: attribution.landingPath,
    referrer_host: attribution.referrerHost,
    acquisition_source: attribution.source,
    acquisition_medium: attribution.medium,
    acquisition_campaign: attribution.campaign,
  });
  if (attribution.source) posthog.capture("search_landing", attribution);
}
