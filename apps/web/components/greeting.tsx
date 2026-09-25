"use client";

import { useSyncExternalStore } from "react";
import { PageHeader } from "@/components/page-header";

const noopSubscribe = () => () => {};

// Read on the client: the server renders in its own timezone (UTC on
// Vercel), so a server-side greeting could say "Good evening" at breakfast.
function snapshot(): string {
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 5 ? "evening" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return `${part}|${date}`;
}

export function Greeting() {
  const value = useSyncExternalStore(noopSubscribe, snapshot, () => null);
  const [part, date] = value?.split("|") ?? [];

  return (
    <PageHeader
      eyebrow={<span className="inline-block min-h-[1lh]">{date}</span>}
      title={part ? `Good ${part}` : "Hello"}
    />
  );
}
