import type { LabelPrintPayload, ReceiptPrintPayload } from "./types";

// ESC/POS command bytes. Thermal printers share this dialect regardless of how
// they are attached, so the same output drives Bluetooth, USB and network.
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type PaperWidth = 58 | 80;

// Characters per line for the default font.
const COLUMNS: Record<PaperWidth, number> = { 58: 32, 80: 48 };

// Thermal printers are codepage devices, not Unicode ones. Anything outside
// ASCII would print as noise, so the few symbols that actually show up in this
// app are spelled out instead.
const SUBSTITUTIONS: [RegExp, string][] = [
  [/₹/g, "Rs."],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, "-"],
  [/…/g, "..."],
];

function toAscii(value: string): string {
  let out = value;
  for (const [pattern, replacement] of SUBSTITUTIONS) out = out.replace(pattern, replacement);
  return out.replace(/[^\x20-\x7e]/g, " ");
}

class EscPosBuilder {
  private bytes: number[] = [];
  readonly columns: number;

  constructor(paperWidth: PaperWidth) {
    this.columns = COLUMNS[paperWidth];
  }

  raw(...bytes: number[]): this {
    this.bytes.push(...bytes);
    return this;
  }

  init(): this {
    return this.raw(ESC, 0x40);
  }

  align(mode: "left" | "center" | "right"): this {
    return this.raw(ESC, 0x61, mode === "left" ? 0 : mode === "center" ? 1 : 2);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** 0 = normal, 1 = double height, 2 = double width + height. */
  size(scale: 0 | 1 | 2): this {
    const n = scale === 0 ? 0x00 : scale === 1 ? 0x01 : 0x11;
    return this.raw(GS, 0x21, n);
  }

  text(value: string): this {
    for (const char of toAscii(value)) this.bytes.push(char.charCodeAt(0) & 0xff);
    return this;
  }

  line(value = ""): this {
    return this.text(value).raw(LF);
  }

  rule(char = "-"): this {
    return this.line(char.repeat(this.columns));
  }

  /** Label on the left, amount flushed right, on one line. */
  columnsLine(left: string, right: string): this {
    const l = toAscii(left);
    const r = toAscii(right);
    const gap = this.columns - l.length - r.length;
    if (gap < 1) {
      // Too long to share a line — the amount is what must stay readable.
      return this.line(l.slice(0, this.columns)).line(r.padStart(this.columns));
    }
    return this.line(l + " ".repeat(gap) + r);
  }

  barcode(value: string): this {
    const data = toAscii(value);
    // CODE128 via GS k 73, length-prefixed, with the code-set B selector the
    // format expects.
    const payload = `{B${data}`;
    this.raw(GS, 0x68, 0x50); // height
    this.raw(GS, 0x77, 0x02); // module width
    this.raw(GS, 0x48, 0x02); // print value underneath
    this.raw(GS, 0x6b, 73, payload.length);
    for (const char of payload) this.bytes.push(char.charCodeAt(0) & 0xff);
    return this;
  }

  feed(lines = 3): this {
    for (let i = 0; i < lines; i++) this.bytes.push(LF);
    return this;
  }

  cut(): this {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

function money(value: number): string {
  return value.toFixed(2);
}

export function encodeReceipt(payload: ReceiptPrintPayload, paperWidth: PaperWidth): Uint8Array {
  const b = new EscPosBuilder(paperWidth);
  b.init().align("center").bold(true).size(1).line(payload.storeName).size(0).bold(false);

  if (payload.headerText) b.line(payload.headerText);
  b.line(payload.documentNumber).align("left").rule();

  for (const line of payload.lines) {
    b.line(line.name);
    b.columnsLine(`  ${line.quantity} x ${money(line.unitPrice)}`, money(line.lineTotal));
  }

  b.rule();
  b.columnsLine("Subtotal", money(payload.subtotal));
  if (payload.discountTotal > 0) b.columnsLine("Discount", `-${money(payload.discountTotal)}`);
  if (payload.taxTotal > 0) b.columnsLine("Tax", money(payload.taxTotal));
  b.bold(true).columnsLine("TOTAL", money(payload.grandTotal)).bold(false);

  if (payload.footerText) b.rule().align("center").line(payload.footerText);
  if (payload.returnPolicyText) b.align("center").line(payload.returnPolicyText);

  return b.feed().cut().build();
}

export function encodeLabels(payload: LabelPrintPayload, paperWidth: PaperWidth): Uint8Array {
  const b = new EscPosBuilder(paperWidth);
  b.init();

  for (const label of payload.labels) {
    for (let copy = 0; copy < Math.max(1, label.copies); copy++) {
      b.align("center")
        .line(label.productName)
        .barcode(label.barcodeValue)
        .line()
        .line(money(label.price))
        .feed(1)
        .cut();
    }
  }

  return b.build();
}

// Opens the till drawer wired into the printer's kick-out port — the standard
// 2-pin pulse, which is why it needs no drawer-specific configuration.
export function encodeCashDrawerKick(): Uint8Array {
  return Uint8Array.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
