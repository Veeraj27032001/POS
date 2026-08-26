import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/uploads/**": ["./node_modules/@img/**/*", "./node_modules/sharp/**/*"],
  },
};

export default nextConfig;
