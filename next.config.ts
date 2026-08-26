import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp resolves its native binding with a dynamic require() (picking the
  // right @img/sharp-<platform> package at runtime) — confirmed by
  // inspecting the actual .nft.json trace: Next's automatic tracer follows
  // sharp's plain JS files but never finds the native binary itself, with
  // or without serverExternalPackages, so it has to be force-included.
  //
  // A first attempt at that (outputFileTracingIncludes pointing straight
  // into node_modules/@img/...) broke deployment instead — under pnpm's
  // default symlinked node_modules, that path is a symlink into the
  // .pnpm store, and Vercel's function packager (unlike Next's own tracer)
  // doesn't resolve through it, failing with "invalid deployment package
  // ... symlinked directories". Fixed by pairing this with .npmrc's
  // node-linker=hoisted, so node_modules/@img/sharp-<platform> is a real
  // directory and the include below points at real files, not a symlink.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/uploads/**": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
