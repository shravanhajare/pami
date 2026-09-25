import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAMI",
    short_name: "PAMI",
    description: "Your personal AI agent — always on your Mac, activated when you need it.",
    start_url: "/",
    display: "standalone",
    // Matches the app's pure-black background, so the launch splash and
    // first paint are one continuous surface.
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
