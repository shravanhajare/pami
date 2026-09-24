"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function RemoteDesktopCard({
  userId,
  initialDevices,
}: {
  userId: string;
  initialDevices: Device[];
}) {
  const devices = useDevicesRealtime(userId, initialDevices).filter(
    (d) => d.status === "trusted",
  );
  const online = devices.find((d) => d.isOnline);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function openSetupOnMac() {
    setSending(true);
    const supabase = createClient();
    await supabase.from("tasks").insert({
      user_id: userId,
      source: "web",
      status: "pending",
      type: "system_command",
      title: "Open Remote Desktop setup",
      prompt: SETUP_COMMAND,
    });
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 6000);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect to your Mac</CardTitle>
          <CardDescription>
            Your Mac&rsquo;s screen, live on this phone — you can click and type on it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <a
            href={ACCESS_URL}
            target="_blank"
            rel="noreferrer"
            className="pami-gradient flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.99]"
          >
            <Monitor className="size-4" />
            Open my Mac&rsquo;s screen
            <ExternalLink className="size-3.5 opacity-70" />
          </a>
          <p className="text-xs text-muted-foreground">
            Opens Google Remote Desktop in a tab and asks for your PIN. Sign in with the
            same Google account you use on the Mac.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">First time? Set up the Mac</CardTitle>
          <CardDescription>
            Do this once. PAMI opens the setup page on the Mac for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <button
            onClick={openSetupOnMac}
            disabled={sending || !online}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-card/60 px-4 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : sent ? (
              <Check className="size-4 text-primary" />
            ) : null}
            {sent ? "Opened on your Mac" : "Open setup on my Mac"}
          </button>

          {!online && (
            <p className="text-xs text-muted-foreground">
              Your Mac is offline, so PAMI can&rsquo;t open it right now. Wake the Mac, or
              go to{" "}
              <span className="text-foreground">remotedesktop.google.com/access</span> on it
              yourself.
            </p>
          )}

          <ol className="flex flex-col gap-2 text-xs text-muted-foreground">
            <li>
              <span className="text-foreground">1.</span> On the Mac, click{" "}
              <span className="text-foreground">Set up remote access</span> and install the
              downloaded package.
            </li>
            <li>
              <span className="text-foreground">2.</span> Choose a name and a 6-digit PIN —
              you&rsquo;ll type that PIN from this phone.
            </li>
            <li>
              <span className="text-foreground">3.</span> Come back here and tap{" "}
              <span className="text-foreground">Open my Mac&rsquo;s screen</span>.
            </li>
          </ol>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Keep the Mac awake for this to work: System Settings → Battery → Options →{" "}
        <span className="text-foreground">Prevent automatic sleeping when the display is off</span>.
      </p>
    </div>
  );
}
