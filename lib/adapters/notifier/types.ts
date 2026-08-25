export interface NotificationMessage {
  to: string;
  channel: "email" | "sms";
  subject?: string;
  body: string;
}

export interface Notifier {
  send(message: NotificationMessage): Promise<{ status: "sent" | "failed" }>;
}
