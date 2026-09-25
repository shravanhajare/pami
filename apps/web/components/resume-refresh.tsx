"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// iOS freezes a Home Screen web app as soon as it leaves the foreground,
// realtime socket included, so reopening it later can show a stale
// dashboard. Re-fetch server data when it comes back after a while (or is
// restored from the back/forward cache) — the realtime hooks pick up the
// fresh rows through their `initial` props.
const STALE_AFTER_MS = 30_000;

export function ResumeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) {
        router.refresh();
      }
    };
    const onPageShow = (e: PageTransitionEvent) => e.persisted && router.refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
