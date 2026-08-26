import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    // Scoped to just the linux-x64 glibc binaries Vercel's Node runtime
    // actually loads. `@img/**/*` (every platform: darwin, win32, musl,
    // arm/ppc64/riscv64/s390x…) pulled in tens of unrelated multi-MB native
    // binaries and broke the build outright.
    "/api/uploads/**": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
