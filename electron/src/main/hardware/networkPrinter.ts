import { Socket } from "node:net";

const CONNECT_TIMEOUT_MS = 8000;

// Network thermal printers listen on 9100 and take ESC/POS straight off the
// socket, so this needs nothing beyond Node.
export function writeNetworkPrinter(host: string, port: number, bytes: Buffer): Promise<void> {
  if (!host) throw new Error("No printer address set.");

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("timeout", () =>
      finish(new Error(`The printer at ${host}:${port} did not respond.`)),
    );
    socket.once("error", (err) => finish(err));
    socket.connect(port, host, () => {
      socket.write(bytes, (err) => {
        if (err) finish(err);
        else socket.end(() => finish());
      });
    });
  });
}
