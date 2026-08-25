import nodemailer from "nodemailer";

import { env } from "@/lib/config/env";

import type { Notifier } from "./types";

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const config = env();
  if (!config.SMTP_HOST || !config.SMTP_PORT || !config.SMTP_USER || !config.SMTP_PASS) {
    throw new Error(
      "NOTIFIER_ADAPTER=email-sms requires SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to be set.",
    );
  }

  cachedTransport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });
  return cachedTransport;
}

export const emailSmsNotifier: Notifier = {
  async send(message) {
    if (message.channel !== "email") {
      throw new Error(
        `Notifier channel "${message.channel}" is not supported by the SMTP adapter.`,
      );
    }

    const config = env();
    await getTransport().sendMail({
      from: config.SMTP_FROM ?? config.SMTP_USER,
      to: message.to,
      subject: message.subject ?? "Notification",
      text: message.body,
    });

    return { status: "sent" };
  },
};
