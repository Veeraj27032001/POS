import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Omnia Retail POS",
    short_name: "Omnia POS",
    description:
      "Store-scoped, multi-storage retail POS for the India market — masters, stock, billing, and reporting in one portal.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f3864",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
