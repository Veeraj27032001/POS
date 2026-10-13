import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { OK_SENTINEL, runPowerShell, wrapScript } from "./powershell";

// A USB or paired Bluetooth thermal printer shows up on Windows as an ordinary
// printer queue, so one mechanism covers both: the spooler's RAW datatype,
// which passes ESC/POS through untouched instead of letting the driver render
// it as a page.
const RAW_PRINT_SCRIPT = wrapScript(`
$source = @'
using System;
using System.Runtime.InteropServices;

public static class VedixRawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void Send(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("Could not open printer '" + printerName + "' (error " + Marshal.GetLastWin32Error() + ")");
        try {
            DOCINFOW info = new DOCINFOW();
            info.pDocName = "Vedix POS";
            info.pDataType = "RAW";
            if (!StartDocPrinter(hPrinter, 1, info))
                throw new Exception("The printer rejected the job (error " + Marshal.GetLastWin32Error() + ")");
            try {
                if (!StartPagePrinter(hPrinter))
                    throw new Exception("The printer rejected the page (error " + Marshal.GetLastWin32Error() + ")");
                IntPtr buffer = Marshal.AllocCoTaskMem(bytes.Length);
                try {
                    Marshal.Copy(bytes, 0, buffer, bytes.Length);
                    int written;
                    if (!WritePrinter(hPrinter, buffer, bytes.Length, out written))
                        throw new Exception("Writing to the printer failed (error " + Marshal.GetLastWin32Error() + ")");
                } finally {
                    Marshal.FreeCoTaskMem(buffer);
                }
                EndPagePrinter(hPrinter);
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
'@
    Add-Type -TypeDefinition $source -Language CSharp
    [VedixRawPrinter]::Send($env:VEDIX_PRINTER, [System.IO.File]::ReadAllBytes($env:VEDIX_PAYLOAD))
`);

export async function writeWindowsPrinter(printerName: string, bytes: Buffer): Promise<void> {
  if (!printerName) throw new Error("No Windows printer selected.");
  // The bytes go via a file rather than the command line: ESC/POS is binary and
  // would not survive PowerShell's text encoding.
  const file = join(
    tmpdir(),
    `vedix-print-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`,
  );
  await writeFile(file, bytes);
  try {
    const output = await runPowerShell(RAW_PRINT_SCRIPT, {
      VEDIX_PRINTER: printerName,
      VEDIX_PAYLOAD: file,
    });
    if (!output.includes(OK_SENTINEL)) {
      throw new Error(`The printer "${printerName}" did not accept the receipt.`);
    }
  } finally {
    await unlink(file).catch(() => {
      // A leftover temp file is not worth failing a sale over.
    });
  }
}

export async function listWindowsPrinters(): Promise<string[]> {
  const output = await runPowerShell("Get-Printer | Select-Object -ExpandProperty Name");
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
