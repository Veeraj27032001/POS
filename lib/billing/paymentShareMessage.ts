export function buildPaymentShareMessage(params: {
  amount: number;
  currencySymbol: string;
  link: string;
  storeName?: string;
}): string {
  const { amount, currencySymbol, link, storeName } = params;
  const who = storeName ? `${storeName}: ` : "";
  return `${who}Your payment of ${currencySymbol}${amount.toFixed(2)} is ready.\n\nPay securely here:\n${link}\n\nThank you!`;
}

export function buildMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
