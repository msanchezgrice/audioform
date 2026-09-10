import type { OperatorNotificationSender } from "./index";
import type { OperatorEmailDeliveryStatus } from "./resend-transport";

export type DispatchDependencies = {
  dispatchWebhooks: () => Promise<unknown>;
  collectNotifications: () => Promise<unknown>;
  emailStatus: () => OperatorEmailDeliveryStatus;
  createEmailSender: () => OperatorNotificationSender | null;
  dispatchEmails: (sender: OperatorNotificationSender) => Promise<{ claimed: number; sent: number; retried: number; dead: number }>;
};

export async function runInternalDispatch(dependencies: DispatchDependencies) {
  const [webhooks, notifications] = await Promise.allSettled([
    dependencies.dispatchWebhooks(),
    dependencies.collectNotifications(),
  ]);

  const status = dependencies.emailStatus();
  let emailDelivery: OperatorEmailDeliveryStatus | (OperatorEmailDeliveryStatus & { claimed: number; sent: number; retried: number; dead: number }) | { configured: true; provider: "resend"; error: "email_dispatch_failed" };
  let emailFailed = !status.configured;
  if (!status.configured) {
    emailDelivery = status;
  } else {
    const sender = dependencies.createEmailSender();
    if (!sender) {
      emailDelivery = { configured: true, provider: "resend", error: "email_dispatch_failed" };
      emailFailed = true;
    } else {
      try {
        const delivery = await dependencies.dispatchEmails(sender);
        emailDelivery = { ...status, ...delivery };
        emailFailed = delivery.retried > 0 || delivery.dead > 0;
      } catch {
        emailDelivery = { configured: true, provider: "resend", error: "email_dispatch_failed" };
        emailFailed = true;
      }
    }
  }

  const failed = webhooks.status === "rejected" || notifications.status === "rejected" || emailFailed;
  return {
    status: failed ? 503 : 200,
    body: {
      webhooks: webhooks.status === "fulfilled" ? webhooks.value : { error: "webhook_dispatch_failed" },
      notifications: notifications.status === "fulfilled" ? notifications.value : { error: "notification_collection_failed" },
      emailDelivery,
    },
  };
}
