"use client";

import { useState, useSyncExternalStore } from "react";
import { Plus, Share, X } from "lucide-react";

const DISMISSED_KEY = "pami-a2hs-dismissed";

const noopSubscribe = () => () => {};

// iOS has no install prompt event, so Safari users never learn PAMI can be
// a full-screen app — and push notifications for approvals only work once
// it is. Shown in Safari on iPhone/iPad until installed or dismissed.
function shouldOffer(): boolean {
  const isIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; touch support gives it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Private mode / blocked storage: just offer it.
  }
  return isIOS && !standalone && !dismissed;
}

export function AddToHomeScreen() {
  const eligible = useSyncExternalStore(noopSubscribe, shouldOffer, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (!eligible || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
  }

  return (
    <div className="relative flex gap-3 rounded-2xl bg-card p-4 pr-10">
      <span className="pami-gradient flex size-11 shrink-0 items-center justify-center rounded-[11px] text-lg font-semibold text-black shadow-sm">
        P
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">Add PAMI to your Home Screen</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
          Opens full screen like an app and can notify you when your Mac needs approval.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
          Tap
          <span className="inline-flex items-center gap-1 rounded-md bg-fill px-1.5 py-0.5 text-foreground">
            <Share className="size-3.5 text-ios-blue" /> Share
          </span>
          then
          <span className="inline-flex items-center gap-1 rounded-md bg-fill px-1.5 py-0.5 text-foreground">
            <Plus className="size-3.5" /> Add to Home Screen
          </span>
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-fill text-muted-foreground active:opacity-60"
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
