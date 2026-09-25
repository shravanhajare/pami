"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// False during SSR and the hydration pass, true after — for output that
// depends on the viewer's clock or timezone ("Today 9:41", "2m ago"),
// which the server (UTC) can't render the same way.
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
