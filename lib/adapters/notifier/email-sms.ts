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

// Fast2SMS wants a bare 10-digit Indian number, not +91-prefixed.
function toIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10);
}

async function sendSms(to: string, body: string): Promise<{ status: "sent" | "failed" }> {
  const apiKey = env().FAST2SMS_API_KEY;
  if (!apiKey) {
    throw new Error("Sending SMS requires FAST2SMS_API_KEY to be set.");
  }

  const params = new URLSearchParams({
    route: "q",
    message: body,
    numbers: toIndianMobile(to),
  });
  const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`, {
    headers: { Authorization: apiKey },
  });
  const data = await res.json().catch(() => null);
  // Fast2SMS returns HTTP 200 even on some failures — actual success/failure
  // is only signalled by the "return" field in the JSON body. Its "message"
  // field is an array on success but a plain string on some error responses.
  if (!res.ok || !data?.return) {
    const reason = Array.isArray(data?.message)
      ? data.message.join(" ")
      : (data?.message ?? `HTTP ${res.status}`);
    throw new Error(`Fast2SMS failed to send: ${reason}`);
  }
  return { status: "sent" };
}

export const emailSmsNotifier: Notifier = {
  async send(message) {
    if (message.channel === "sms") {
      return sendSms(message.to, message.body);
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
