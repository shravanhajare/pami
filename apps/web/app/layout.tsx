import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAMI",
  description: "Your personal AI agent.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PAMI",
  },
  // Task results are full of numbers ("82%", "3:30", disk sizes) that iOS
  // would otherwise underline as tappable phone numbers.
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  // Lets env(safe-area-inset-*) resolve to real values instead of 0 — needed
  // for the bottom tab bar/header to clear the iPhone notch and home
  // indicator when this is added to the Home Screen as a standalone PWA
  // (see manifest.ts: display: "standalone").
  viewportFit: "cover",
};

// The app is dark-only on purpose: the Home Screen web app uses the
// black-translucent status bar (white clock/battery drawn over the page),
// which would be unreadable over a light background.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_70%_60%_at_50%_-20%,color-mix(in_oklch,var(--pami-purple)_14%,transparent),transparent)]" />
        {children}
      </body>
    </html>
  );
}
