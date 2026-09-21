import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PAMI",
  description: "Your personal AI agent.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PAMI",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  // Lets env(safe-area-inset-*) resolve to real values instead of 0 — needed
  // for the bottom tab bar/header to clear the iPhone notch and home
  // indicator when this is added to the Home Screen as a standalone PWA
  // (see manifest.ts: display: "standalone").
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,color-mix(in_oklch,var(--pami-purple)_18%,transparent),transparent)]" />
        {children}
      </body>
    </html>
  );
}
