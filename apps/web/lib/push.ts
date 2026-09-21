// PushManager.subscribe wants the VAPID public key as a raw Uint8Array, not
// the base64url string it's normally shared/stored as.
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // `new Uint8Array(length)` rather than `Uint8Array.from(...)` — the
  // latter's inferred type (Uint8Array<ArrayBufferLike>) doesn't satisfy
  // PushSubscriptionOptionsInit.applicationServerKey's BufferSource type
  // under the current TS DOM lib.
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
