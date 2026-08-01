import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// The service worker precaches the app shell, so a client keeps running the
// build it started with until a newer worker takes over. Browsers only look for
// a new worker on a full page load, which a standalone PWA or a long-lived tab
// may never do — leaving users on a stale build long after a deploy.
const UPDATE_CHECK_INTERVAL_MS = 60_000;

if ("serviceWorker" in navigator) {
  // Read before registerSW.js runs: a controller here means the app shell came
  // from an existing worker, so a later handover is an update rather than the
  // first install — reloading on the first install would loop.
  const wasControlled = Boolean(navigator.serviceWorker.controller);

  // Deliberately narrow: only the focused field counts. A broader "is any form
  // dirty" check risks reading as permanently dirty and blocking updates
  // forever, which is the failure this whole block exists to prevent.
  const isTyping = () => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return false;
    if (active.isContentEditable) return true;
    if (active.tagName === "TEXTAREA") return (active as HTMLTextAreaElement).value.length > 0;
    if (active.tagName === "INPUT") {
      const input = active as HTMLInputElement;
      return input.type === "file" ? (input.files?.length ?? 0) > 0 : input.value.length > 0;
    }
    return false;
  };

  let isRefreshing = false;
  let reloadPending = false;

  const applyUpdate = () => {
    if (isRefreshing) return;

    // The new worker is already active, so the reload can wait rather than
    // discard what someone is in the middle of typing.
    if (isTyping()) {
      reloadPending = true;
      return;
    }

    isRefreshing = true;
    window.location.reload();
  };

  if (wasControlled) {
    navigator.serviceWorker.addEventListener("controllerchange", applyUpdate);
  }

  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.update().catch(() => {
        // Offline or sw.js unreachable — the next check picks it up.
      });
    });
  };

  window.addEventListener("load", () => {
    window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
  });

  // Leaving a field is the first safe moment to apply a deferred update.
  document.addEventListener("focusout", () => {
    if (reloadPending) applyUpdate();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;

    // Reopening an installed PWA is the most common moment a user has missed
    // one or more deploys, so re-check on the way back in.
    if (reloadPending) applyUpdate();
    checkForUpdate();
  });

  window.addEventListener("online", checkForUpdate);
}

createRoot(document.getElementById("root")!).render(<App />);
