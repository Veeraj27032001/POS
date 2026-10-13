import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { OK_SENTINEL, runPowerShell, wrapScript } from "./powershell";

// Bluetooth thermal printers that pair as a virtual COM port, and genuinely
// serial ones, are both reached this way.
const SERIAL_WRITE_SCRIPT = wrapScript(`
    $port = New-Object System.IO.Ports.SerialPort $env:VEDIX_PORT, ([int]$env:VEDIX_BAUD), "None", 8, "One"
    $port.WriteTimeout = 8000
    $port.Open()
    try {
        $bytes = [System.IO.File]::ReadAllBytes($env:VEDIX_PAYLOAD)
        $port.Write($bytes, 0, $bytes.Length)
        # Closing before the printer has drained its buffer truncates the receipt.
        Start-Sleep -Milliseconds 400
    } finally {
        $port.Close()
    }
`);

const DEFAULT_BAUD = 9600;

export async function writeSerialPrinter(
  portName: string,
  bytes: Buffer,
  baudRate = DEFAULT_BAUD,
): Promise<void> {
  if (!portName) throw new Error("No COM port selected.");
  const file = join(
    tmpdir(),
    `vedix-serial-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`,
  );
  await writeFile(file, bytes);
  try {
    const output = await runPowerShell(SERIAL_WRITE_SCRIPT, {
      VEDIX_PORT: portName,
      VEDIX_BAUD: String(baudRate),
      VEDIX_PAYLOAD: file,
    });
    if (!output.includes(OK_SENTINEL)) {
      throw new Error(`The printer on ${portName} did not accept the receipt.`);
    }
  } finally {
    await unlink(file).catch(() => {
      // A leftover temp file is not worth failing a sale over.
    });
  }
}

export async function listSerialPorts(): Promise<string[]> {
  const output = await runPowerShell("[System.IO.Ports.SerialPort]::GetPortNames()");
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
