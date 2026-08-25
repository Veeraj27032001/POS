import { OTP } from "otplib";
import QRCode from "qrcode";

import { unscoped } from "@/lib/db";

const otp = new OTP({ strategy: "totp" });

export function generateTotpSecret(): string {
  return otp.generateSecret();
}

export function buildOtpAuthUri(email: string, secret: string): string {
  return otp.generateURI({ issuer: "POS", label: email, secret });
}

export async function buildOtpQrCodeDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(buildOtpAuthUri(email, secret));
}

export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  const result = await otp.verify({ secret, token, epochTolerance: [2, 2] });
  return result.valid;
}

export async function verifyTotpAgainstDevices(userId: string, code: string): Promise<boolean> {
  const db = unscoped();
  const devices = await db.mfaDevice.findMany({ where: { userId } });
  for (const device of devices) {
    if (await verifyTotpToken(device.secret, code)) {
      await db.mfaDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
      return true;
    }
  }
  return false;
}
