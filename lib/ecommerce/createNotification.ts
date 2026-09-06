import type { NotificationEventType, NotificationRelatedType } from "@/generated/prisma/client";
import { getNotifier } from "@/lib/adapters/notifier";
import { unscoped } from "@/lib/db";

const EVENT_MESSAGES: Record<NotificationEventType, { subject: string; body: string }> = {
  refund_processing: {
    subject: "Your refund is being processed",
    body: "We've started processing your refund. It can take a few days to reach you.",
  },
  refund_completed: {
    subject: "Your refund is complete",
    body: "Your refund has been completed.",
  },
  refund_failed: {
    subject: "There was a problem with your refund",
    body: "We couldn't complete your refund. Please contact the store for help.",
  },
  order_cancelled: {
    subject: "Your order was cancelled",
    body: "Your order has been cancelled.",
  },
  order_rejected: {
    subject: "We couldn't accept your order",
    body: "We're sorry, we couldn't fulfil your order. Any payment will be refunded — please contact the store if you have questions.",
  },
};

// step7 §6 — an online customer isn't standing at the counter to be told in
// person, so a Notification row + an actual send (via the same Notifier
// adapter payment requests already use) stand in for that.
export async function createNotification(params: {
  customerId: string;
  eventType: NotificationEventType;
  relatedType: NotificationRelatedType;
  relatedId: string;
}) {
  const db = unscoped();
  const customer = await db.customer.findUnique({ where: { id: params.customerId } });
  if (!customer) return null;

  const channel = customer.email ? "email" : customer.phone ? "sms" : null;
  const to = channel === "email" ? customer.email : customer.phone;
  if (!channel || !to) return null;

  const notification = await db.notification.create({
    data: {
      customerId: params.customerId,
      eventType: params.eventType,
      channel,
      relatedType: params.relatedType,
      relatedId: params.relatedId,
      status: "pending",
    },
  });

  const message = EVENT_MESSAGES[params.eventType];
  const result = await getNotifier().send({
    to,
    channel,
    subject: message.subject,
    body: message.body,
  });

  return db.notification.update({
    where: { id: notification.id },
    data: {
      status: result.status,
      sentAt: result.status === "sent" ? new Date() : null,
    },
  });
}
