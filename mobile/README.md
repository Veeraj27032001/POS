# Vedix POS — Android shell

A thin Capacitor wrapper around the hosted POS app, mirroring what `electron/`
does on Windows: it does not contain the UI. The web app is server-rendered
(Route Handlers, RSC streaming), so there is nothing to bundle — the shell
loads `https://pos.vedixsolutions.com` and exists to add native capability on
top, exactly as the desktop shell adds the printer bridge.

`www/index.html` is only the fallback shown when the server can't be reached.

## Prerequisites

Not yet installed on the current dev machine:

- **Android Studio** (bundles the SDK, platform-tools and an emulator), or the
  standalone `cmdline-tools` plus an SDK platform and build-tools.
- **JDK 21.** The Android Gradle Plugin does not support JDK 24, which is what
  `java -version` currently reports here — Gradle will refuse to build against
  it. Install JDK 21 and point `JAVA_HOME` at it (Android Studio ships one).
- Roughly **5–8 GB** free for the SDK, platforms and Gradle caches.

## Everyday commands

```bash
cd mobile
npm install                 # once
npm run sync                # push capacitor.config.ts into the native project
npm run open                # open the project in Android Studio
npm run apk:debug           # android/app/build/outputs/apk/debug/
npm run apk:release         # needs signing config, see below
```

Point the app at a different server without editing anything:

```bash
SERVER_URL=https://staging.example.com npm run sync
```

For a dev server on this machine, use `http://10.0.2.2:3000` from the Android
emulator (`localhost` on the device means the device itself). Plain `http://`
automatically enables cleartext for that build only — release builds targeting
the real server stay HTTPS-only.

## Signing a release

Release APKs must be signed or Android won't install them:

```bash
keytool -genkey -v -keystore vedix-pos.keystore -alias vedix \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore **out of the repo** (`mobile/*.keystore` is gitignored) and
back it up — losing it means you can never update an installed app in place.
Wire it into `android/app/build.gradle` via a `signingConfigs` block reading
from `local.properties` or environment variables, never hardcoded.

## What this shell does not do yet

- **No hardware bridge.** The web app calls `window.hardware` through
  `lib/adapters/print`, and that object only exists inside Electron today, so
  on Android `getPrintBridge()` falls back to the browser print path. Receipt
  printing, label printing and the cash drawer need a Capacitor plugin
  implementing the same `HardwareBridge` interface (`lib/adapters/print/types.ts`)
  over Bluetooth/USB ESC-POS — then every existing print call site works
  untouched, exactly as it did when the Electron bridge landed.
- **No offline support.** Every screen needs the server. See the note in
  `PLAN/step2.md` about NJS-23's architecture — the same trade-off applies here.
- **Barcode scanning** works already where the device exposes a scanner as a
  keyboard (most rugged Android POS terminals do), since the billing scan input
  just reads keystrokes. Camera scanning would need ML Kit.
