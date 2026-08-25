# POS Application — step10: Mobile Scanner Companion App

**Another separate application, like step9** — not a module inside the POS web app. A Flutter app (Android + iOS, one codebase) that pairs with a POS terminal over Bluetooth and turns the phone's camera into a barcode scanner, alongside — not instead of — the physical USB/Bluetooth scanner support already covered in step2's NJS-23.

---

## 1. What It's For

A physical barcode scanner (step2, NJS-23) is the primary, always-available option at a fixed terminal. This app covers the cases that don't fit that: a second person doing a stock count away from the counter, a mobile stock-take walking the aisles, or simply a backup when a physical scanner isn't at hand. Same barcode fields it's reading against — `sku/barcode` and `system_barcode` (step3, MST-PRD) — nothing new on the data side.

## 2. Pairing

1. On the POS terminal (the Next.js app, running in Electron per NJS-23), a **Pair Device** screen shows a short-lived pairing code.
2. The phone app scans that code or enters it manually, then connects over Bluetooth.
3. Once paired, every barcode the phone reads is sent to the terminal in real time — the terminal treats it exactly like a scan from a physical USB scanner (step5, Section 7's scan-to-add flow triggers the same way either way).

**Pairing is per-session, not permanent.** Closing the terminal app or the phone app ends the pairing; reconnecting needs a fresh code. This avoids a phone staying silently connected to a terminal it shouldn't be anymore.

## 3. Scanning

- Camera-based barcode recognition (standard barcode/QR scanning, not a custom model) — point the phone at a barcode, it reads it the same way a laser scanner would.
- Continuous scan mode for a stock-take (scan one item after another without re-opening the camera each time) and single-scan mode for adding one item to an in-progress bill remotely.
- Works fully offline on the phone's side — only the *result* (the decoded barcode) needs the Bluetooth connection to reach the terminal, not the scanning itself.

## 4. What This Doesn't Change

- **Physical scanner support isn't replaced.** NJS-23's USB/Bluetooth HID scanner integration stays exactly as it was — this app is an additional input path, not a migration off the existing one.
- **No new barcode format or field.** The phone reads the same `sku/barcode`/`system_barcode` values already defined in step3 — this app doesn't introduce a third identifier.
- **Billing logic doesn't change.** A barcode arriving from this app hits the same scan-to-add flow (step5, Section 7) as one typed at the keyboard or read by a physical scanner — same oversell check, same warehouse allocation, same everything downstream of "a barcode was scanned."

---

## Master changes this document required

None — this app reads and sends existing barcode values; it doesn't add fields to any master or transaction.
