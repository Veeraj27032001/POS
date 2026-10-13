import { spawn } from "node:child_process";

const NEWLINE = /\r?\n/;

// Windows printing and serial ports are reached through PowerShell rather than
// a native node module. node-gyp builds have to be rebuilt against every
// Electron version and fail on machines without build tools, which is a poor
// trade for calls this thin — and a till that cannot print is a till that
// cannot sell.

// PowerShell exits 0 even when a statement throws, so a write has to report
// success itself. Without this a dead printer looks like a successful print and
// the receipt silently never appears.
export const OK_SENTINEL = "VEDIX_OK";
const ERROR_SENTINEL = "VEDIX_ERROR:";

export function wrapScript(body: string): string {
  return `
$ErrorActionPreference = "Stop"
try {
${body}
    Write-Output "${OK_SENTINEL}"
} catch {
    Write-Output "${ERROR_SENTINEL} $($_.Exception.Message)"
    exit 1
}
`;
}

export function runPowerShell(script: string, env: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    // -EncodedCommand, not stdin: PowerShell reads piped input the way it reads
    // an interactive prompt, where a blank line ends the block. A script with
    // one in the middle is silently truncated and exits 0 having done nothing.
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { env: { ...process.env, ...env }, windowsHide: true },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(readError(stdout, stderr, code)));
    });

    child.stdin.end();
  });
}

// Failures are reported on stdout, because PowerShell serialises a redirected
// error stream as CLIXML and the cashier should not be shown that.
function readError(stdout: string, stderr: string, code: number | null): string {
  const reported = stdout
    .split(NEWLINE)
    .map((line) => line.trim())
    .find((line) => line.startsWith(ERROR_SENTINEL));
  if (reported) return unwrapDotNet(reported.slice(ERROR_SENTINEL.length).trim());

  const plainStderr = stderr.includes("#< CLIXML") ? "" : stderr.trim().split(NEWLINE)[0];
  return plainStderr || `PowerShell exited with code ${code}`;
}

// PowerShell wraps a .NET exception as: Exception calling "X" with "N"
// argument(s): "the part anyone actually wants".
function unwrapDotNet(message: string): string {
  const match = /^Exception calling .+ with .+ argument\(s\): "([\s\S]*)"$/.exec(message);
  return match ? match[1] : message;
}
