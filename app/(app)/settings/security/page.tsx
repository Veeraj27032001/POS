"use client";

import { Loader2Icon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { cn } from "@/lib/utils";

interface MfaDevice {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

type MfaMethod = "totp" | "email_otp" | null;

interface EnrollResponse {
  secret: string;
  otpAuthUri: string;
  qrCodeDataUrl: string;
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

function ButtonSpinner() {
  return <Loader2Icon className="size-3.5 animate-spin" />;
}

export default function SecuritySettingsPage() {
  const [mfaMethod, setMfaMethod] = useState<MfaMethod | undefined>(undefined);
  const [devices, setDevices] = useState<MfaDevice[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollResponse | null>(null);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [enrollCode, setEnrollCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);
  const [removeCode, setRemoveCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const busy = busyAction !== null;
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  function refreshStatus() {
    fetch("/api/auth/mfa/status")
      .then((res) => res.json())
      .then((json: { mfaMethod: MfaMethod; devices: MfaDevice[] }) => {
        setMfaMethod(json.mfaMethod);
        setDevices(json.devices);
      });
  }

  useEffect(refreshStatus, []);

  async function withBusy(action: string, fn: () => Promise<void>) {
    setBusyAction(action);
    setError(null);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  }

  async function startEnroll() {
    await withBusy("start-enroll", async () => {
      const res = await fetch("/api/auth/mfa/totp/enroll", { method: "POST" });
      if (!res.ok) {
        setError("Failed to start enrollment.");
        return;
      }
      setEnrollment(await res.json());
      setDeviceLabel("");
      setEnrollCode("");
    });
  }

  async function confirmEnroll() {
    if (!enrollment) return;
    await withBusy("confirm-enroll", async () => {
      const res = await fetch("/api/auth/mfa/totp/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: enrollment.secret,
          code: enrollCode,
          label: deviceLabel || "Authenticator device",
        }),
      });
      if (!res.ok) {
        setError(await parseErrorMessage(res, "That code is incorrect."));
        return;
      }
      setEnrollment(null);
      setEnrollCode("");
      setDeviceLabel("");
      toast.success("Authenticator device added.");
      refreshStatus();
    });
  }

  async function removeDevice(id: string, requireCode: boolean) {
    if (requireCode) {
      setRemovingDeviceId(id);
      setRemoveCode("");
      setError(null);
      return;
    }
    if (!window.confirm("Remove this authenticator device?")) return;

    await withBusy(`remove-${id}`, async () => {
      const res = await fetch(`/api/auth/mfa/totp/devices/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        toast.error(await parseErrorMessage(res, "Failed to remove device."));
        return;
      }
      toast.success("Device removed.");
      refreshStatus();
    });
  }

  async function confirmRemoveLastDevice() {
    if (!removingDeviceId) return;
    await withBusy("confirm-remove-last", async () => {
      const res = await fetch(`/api/auth/mfa/totp/devices/${removingDeviceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: removeCode }),
      });
      if (!res.ok) {
        setError(await parseErrorMessage(res, "That code is incorrect."));
        return;
      }
      setRemovingDeviceId(null);
      setRemoveCode("");
      toast.success("Two-factor authentication disabled.");
      refreshStatus();
    });
  }

  async function switchToEmailOtp() {
    await withBusy("switch-email", async () => {
      const res = await fetch("/api/auth/mfa/email-otp/enable", { method: "POST" });
      if (!res.ok) {
        setError(await parseErrorMessage(res, "Failed to switch method."));
        return;
      }
      toast.success("Email code enabled.");
      refreshStatus();
    });
  }

  async function switchToTotp() {
    if (devices.length > 0) {
      await withBusy("switch-totp", async () => {
        const res = await fetch("/api/auth/mfa/totp/enable", { method: "POST" });
        if (!res.ok) {
          setError(await parseErrorMessage(res, "Failed to switch method."));
          return;
        }
        toast.success("Authenticator app enabled.");
        refreshStatus();
      });
      return;
    }
    await startEnroll();
  }

  async function requestEmailDisableCode() {
    await withBusy("request-email-code", async () => {
      const res = await fetch("/api/auth/mfa/email-otp/request", { method: "POST" });
      if (!res.ok) {
        setError(await parseErrorMessage(res, "Failed to send code."));
        return;
      }
      setEmailCodeSent(true);
      toast.success("Code sent to your email.");
    });
  }

  async function disable() {
    await withBusy("disable", async () => {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      if (!res.ok) {
        setError(await parseErrorMessage(res, "That code is incorrect."));
        return;
      }
      setDisableCode("");
      setEmailCodeSent(false);
      toast.success("Two-factor authentication disabled.");
      refreshStatus();
    });
  }

  return (
    <div ref={kbdRef} className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Security</h1>
        {mfaMethod !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              mfaMethod ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {mfaMethod ? (
              <ShieldCheckIcon className="size-3.5" />
            ) : (
              <ShieldOffIcon className="size-3.5" />
            )}
            {mfaMethod ? "Two-factor enabled" : "Two-factor disabled"}
          </span>
        )}
      </div>

      <div className="max-w-md space-y-6">
        {mfaMethod === undefined && <LoadingState />}

        {mfaMethod === null && !enrollment && (
          <div className="space-y-4 rounded-2xl border p-4">
            <p>Two-factor authentication is not enabled on your account.</p>
            <div className="flex gap-2">
              <Button data-kbd-item="" disabled={busy} onClick={startEnroll}>
                {busyAction === "start-enroll" && <ButtonSpinner />}
                Set up authenticator app
              </Button>
              <Button variant="outline" data-kbd-item="" disabled={busy} onClick={switchToEmailOtp}>
                {busyAction === "switch-email" && <ButtonSpinner />}
                Enable email code
              </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {mfaMethod === "totp" && !enrollment && (
          <div className="space-y-4 rounded-2xl border p-4">
            <p>Authenticator app is enabled on your account.</p>

            <ul className="space-y-2" data-testid="mfa-device-list">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{device.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {device.lastUsedAt
                        ? `Last used ${new Date(device.lastUsedAt).toLocaleDateString()}`
                        : "Never used"}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-kbd-item=""
                    disabled={busy}
                    onClick={() => removeDevice(device.id, devices.length === 1)}
                  >
                    {busyAction === `remove-${device.id}` && <ButtonSpinner />}
                    Remove
                  </Button>
                </li>
              ))}
            </ul>

            {removingDeviceId && (
              <div className="space-y-1.5 rounded-md border p-3">
                <Label htmlFor="remove-code">
                  This is your last device. Enter its code to remove it and disable 2FA.
                </Label>
                <Input
                  id="remove-code"
                  inputMode="numeric"
                  maxLength={6}
                  data-kbd-item=""
                  value={removeCode}
                  onChange={(e) => setRemoveCode(e.target.value)}
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    data-kbd-item=""
                    disabled={busy}
                    onClick={confirmRemoveLastDevice}
                  >
                    {busyAction === "confirm-remove-last" && <ButtonSpinner />}
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-kbd-item=""
                    disabled={busy}
                    onClick={() => {
                      setRemovingDeviceId(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                data-kbd-item=""
                disabled={busy}
                onClick={startEnroll}
              >
                {busyAction === "start-enroll" && <ButtonSpinner />}
                Add another device
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-kbd-item=""
                disabled={busy}
                onClick={switchToEmailOtp}
              >
                {busyAction === "switch-email" && <ButtonSpinner />}
                Switch to email code
              </Button>
            </div>

            <div className="space-y-1.5 border-t pt-4">
              <Label htmlFor="disable-code">Enter a device code to disable two-factor auth</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                maxLength={6}
                data-kbd-item=""
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                variant="destructive"
                size="sm"
                data-kbd-item=""
                disabled={busy}
                onClick={disable}
              >
                {busyAction === "disable" && <ButtonSpinner />}
                Disable two-factor authentication
              </Button>
            </div>
          </div>
        )}

        {mfaMethod === "email_otp" && (
          <div className="space-y-4 rounded-2xl border p-4">
            <p>Email code is enabled on your account.</p>

            <Button
              variant="outline"
              size="sm"
              data-kbd-item=""
              disabled={busy}
              onClick={switchToTotp}
            >
              {(busyAction === "switch-totp" || busyAction === "start-enroll") && <ButtonSpinner />}
              Switch to authenticator app
            </Button>

            <div className="space-y-1.5 border-t pt-4">
              {!emailCodeSent ? (
                <Button
                  variant="outline"
                  size="sm"
                  data-kbd-item=""
                  disabled={busy}
                  onClick={requestEmailDisableCode}
                >
                  {busyAction === "request-email-code" && <ButtonSpinner />}
                  Send a code to disable two-factor auth
                </Button>
              ) : (
                <>
                  <Label htmlFor="disable-code-email">Enter the emailed code</Label>
                  <Input
                    id="disable-code-email"
                    inputMode="numeric"
                    maxLength={6}
                    data-kbd-item=""
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button
                    variant="destructive"
                    size="sm"
                    data-kbd-item=""
                    disabled={busy}
                    onClick={disable}
                  >
                    {busyAction === "disable" && <ButtonSpinner />}
                    Disable two-factor authentication
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {enrollment && (
          <div className="space-y-4 rounded-2xl border p-4">
            <p>Scan this QR code with your authenticator app, then enter the code it shows.</p>
            <Image
              src={enrollment.qrCodeDataUrl}
              alt="Authenticator QR code"
              width={200}
              height={200}
              unoptimized
            />
            <p className="text-muted-foreground font-mono text-xs break-all">{enrollment.secret}</p>

            <div className="space-y-1.5">
              <Label htmlFor="device-label">Device name</Label>
              <Input
                id="device-label"
                placeholder="e.g. My phone"
                data-kbd-item=""
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="verify-code">Authenticator code</Label>
              <Input
                id="verify-code"
                inputMode="numeric"
                maxLength={6}
                data-kbd-item=""
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button data-kbd-item="" disabled={busy} onClick={confirmEnroll}>
                {busyAction === "confirm-enroll" && <ButtonSpinner />}
                Confirm
              </Button>
              <Button
                variant="outline"
                data-kbd-item=""
                disabled={busy}
                onClick={() => {
                  setEnrollment(null);
                  setEnrollCode("");
                  setDeviceLabel("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
