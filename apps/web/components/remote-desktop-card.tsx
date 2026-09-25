"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, Monitor, MoonStar } from "lucide-react";
import { useRunOnMac } from "@/components/live-activity";
import { useDevicesRealtime } from "@/hooks/use-devices-realtime";
import type { Database } from "@/lib/supabase/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

const ACCESS_URL = "https://remotedesktop.google.com/access";

// Google serves remotedesktop.google.com with X-Frame-Options: SAMEORIGIN,
// so its client can't be embedded in a page here — the screen itself has to
// open in a browser tab. What PAMI owns is everything around that: turning
// the Mac into a host with one tap (no walking over to it), and being the
// one place you launch the session from.
const SETUP_COMMAND =
  `open -a "Google Chrome" "${ACCESS_URL}" || open "${ACCESS_URL}"`;

const STEPS = [
  <>
    On the Mac, click <b className="font-semibold text-foreground">Set up remote access</b> and install the
    downloaded package.
  </>,
  <>
    Choose a name and a 6-digit PIN — you&rsquo;ll type that PIN from this phone.
  </>,
  <>
    Come back here and tap <b className="font-semibold text-foreground">Open my Mac&rsquo;s screen</b>.
  </>,
];

export function RemoteDesktopCard({
  userId,
  initialDevices,
}: {
  userId: string;
  initialDevices: Device[];
}) {
  const run = useRunOnMac();
  const devices = useDevicesRealtime(userId, initialDevices).filter(
    (d) => d.status === "trusted",
  );
  const online = devices.find((d) => d.isOnline);
  const [sending, setSending] = useState(false);

  async function openSetupOnMac() {
    setSending(true);
    await run(
      { type: "system_command", title: "Open Remote Desktop setup", prompt: SETUP_COMMAND },
      { label: "Remote Desktop setup" },
    );
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-5 pt-7 pb-5 text-center">
        <span className="flex size-16 items-center justify-center rounded-[18px] bg-gradient-to-b from-ios-blue to-ios-indigo text-white shadow-lg shadow-ios-blue/20">
          <Monitor className="size-8" />
        </span>
        <div>
          <p className="text-[20px] font-semibold">Connect to your Mac</p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Your Mac&rsquo;s screen, live on this phone — tap and type on it.
          </p>
        </div>
        <a
          href={ACCESS_URL}
          target="_blank"
          rel="noreferrer"
          className="pressable flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground"
        >
          Open my Mac&rsquo;s screen
          <ArrowUpRight className="size-4.5" strokeWidth={2.5} />
        </a>
        <p className="text-[13px] text-muted-foreground">
          Opens Google Remote Desktop and asks for your PIN. Use the same Google account as on the Mac.
        </p>
      </div>

      <section className="flex flex-col gap-1.5">
        <h2 className="px-4 text-[13px] tracking-wide text-muted-foreground uppercase">First Time Setup</h2>
        <div className="rounded-2xl bg-card p-4">
          <ol className="flex flex-col gap-3.5">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-snug text-muted-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-[13px] font-semibold text-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={openSetupOnMac}
            disabled={sending || !online}
            className="pressable mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fill text-[17px] font-semibold text-tint disabled:opacity-40"
          >
            {sending && <Loader2 className="size-4 animate-spin" />}
            Open Setup on My Mac
          </button>
        </div>
        <p className="px-4 text-[13px] leading-snug text-muted-foreground">
          {online ? (
            "Do this once. PAMI opens the setup page on the Mac for you."
          ) : (
            <>
              Your Mac is offline, so PAMI can&rsquo;t open it right now. Wake the Mac, or go to{" "}
              <span className="text-foreground">remotedesktop.google.com/access</span> on it yourself.
            </>
          )}
        </p>
      </section>

      <div className="flex gap-3 rounded-2xl bg-card p-4">
        <MoonStar className="mt-0.5 size-5 shrink-0 text-ios-indigo" />
        <p className="text-[13px] leading-snug text-muted-foreground">
          Keep the Mac awake for this to work: System Settings → Battery → Options →{" "}
          <span className="text-foreground">Prevent automatic sleeping when the display is off</span>.
        </p>
      </div>
    </div>
  );
}
