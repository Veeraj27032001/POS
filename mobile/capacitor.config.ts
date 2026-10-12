import type { CapacitorConfig } from "@capacitor/cli";

// The POS UI is server-rendered (Next.js route handlers, RSC streaming), so
// there is nothing to bundle into the app — the shell loads the hosted app
// exactly as the Electron desktop build does, and adds hardware on top.
// Override for a local or staging server at build time:
//   SERVER_URL=http://10.0.2.2:3000 npm run sync
const SERVER_URL = process.env.SERVER_URL ?? "https://pos.vedixsolutions.com";
const isLocal = /^http:\/\//.test(SERVER_URL);

const config: CapacitorConfig = {
  appId: "com.vedixsolutions.pos",
  appName: "Vedix POS",
  // Only the offline fallback page lives here; the real UI comes from the server.
  webDir: "www",
  server: {
    url: SERVER_URL,
    // Plain http is only ever allowed when pointing at a dev machine.
    cleartext: isLocal,
  },
  android: {
    allowMixedContent: isLocal,
  },
};

export default config;
