import { useEffect, useState } from "react";

/** The installable app (Phase 3 task 8, #10): public/manifest.webmanifest and public/sw.js. The service worker runs in
 * production builds only (the dev server reloads modules itself). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined); // the app works without it
  });
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // offered from the account menu instead of the browser's banner
    deferred = event as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** `install` when the browser offers to install the app (Chrome, Edge, Android), else null (already installed, or
 * Safari: Share → Add to Home Screen). */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const [, rerender] = useState(0);
  useEffect(() => {
    const update = () => rerender((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  if (!deferred) return null;
  return async () => {
    const event = deferred;
    deferred = null;
    listeners.forEach((l) => l());
    await event?.prompt();
  };
}
