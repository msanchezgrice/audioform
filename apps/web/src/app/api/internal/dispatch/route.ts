import { authorizedInternalRequest } from "@/lib/internal-auth";
import { collectOperatorNotifications, dispatchOperatorNotifications } from "@/lib/operator-notifications";
import { runInternalDispatch } from "@/lib/operator-notifications/dispatch-runner";
import { createResendOperatorNotificationSender, getOperatorEmailDeliveryStatus } from "@/lib/operator-notifications/resend-transport";
import { dispatchWebhookBatch } from "@/lib/platform/webhooks";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "cache-control": "no-store" };

const defaultDependencies = {
  dispatchWebhooks: dispatchWebhookBatch,
  collectNotifications: collectOperatorNotifications,
  emailStatus: getOperatorEmailDeliveryStatus,
  createEmailSender: createResendOperatorNotificationSender,
  dispatchEmails: (sender) => dispatchOperatorNotifications(sender, { limit: 5 }),
} satisfies Parameters<typeof runInternalDispatch>[0];

export async function GET(request: Request) {
  if (!authorizedInternalRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const result = await runInternalDispatch(defaultDependencies);
  return Response.json(result.body, { status: result.status, headers });
}
