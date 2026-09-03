"use client";

import { MailIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildMailtoUrl,
  buildPaymentShareMessage,
  buildWhatsAppUrl,
} from "@/lib/billing/paymentShareMessage";

export function SendLinkPanel({
  link,
  amount,
  currencySymbol,
  storeName,
  defaultEmail,
  defaultPhone,
}: {
  link: string;
  amount: number;
  currencySymbol: string;
  storeName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const message = buildPaymentShareMessage({ amount, currencySymbol, link, storeName });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-xs font-medium">Send this link</p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!email.trim()}
          onClick={() =>
            window.open(buildMailtoUrl(email.trim(), "Payment link", message), "_blank")
          }
        >
          <MailIcon className="size-3.5" />
          Email
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!phone.trim()}
          onClick={() => window.open(buildWhatsAppUrl(phone.trim(), message), "_blank")}
        >
          <MessageCircleIcon className="size-3.5" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}
