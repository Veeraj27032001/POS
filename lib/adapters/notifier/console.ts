import type { Notifier } from "./types";

export const consoleNotifier: Notifier = {
  async send(message) {
    console.log(
      `[notifier:${message.channel}] to=${message.to}` +
        (message.subject ? ` subject=${JSON.stringify(message.subject)}` : "") +
        ` body=${JSON.stringify(message.body)}`,
    );
    return { status: "sent" };
  },
};
