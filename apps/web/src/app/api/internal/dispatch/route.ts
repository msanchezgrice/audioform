import { authorizedInternalRequest } from "@/lib/internal-auth";
import { collectOperatorNotifications } from "@/lib/operator-notifications";
import { dispatchWebhookBatch } from "@/lib/platform/webhooks";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "cache-control": "no-store" };

export async function GET(request: Request) {
  if (!authorizedInternalRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const [webhooks, notifications] = await Promise.allSettled([
    dispatchWebhookBatch(),
    collectOperatorNotifications(),
  ]);
  const failed = webhooks.status === "rejected" || notifications.status === "rejected";
  return Response.json({
    webhooks: webhooks.status === "fulfilled" ? webhooks.value : { error: "webhook_dispatch_failed" },
    notifications: notifications.status === "fulfilled" ? notifications.value : { error: "notification_collection_failed" },
    emailDelivery: "awaiting_provider_connection",
  }, { status: failed ? 503 : 200, headers });
}
