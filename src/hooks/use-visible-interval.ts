import { useEffect, useRef } from "react";

/**
 * Like setInterval, but only ticks while the tab is visible. When the tab
 * becomes visible again the callback runs immediately so data is fresh.
 * Pass `null` as the delay to pause.
 */
export function useVisibleInterval(callback: () => void, delayMs: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;

    let timer: number | undefined;
    const start = () => {
      if (timer === undefined) timer = window.setInterval(() => savedCallback.current(), delayMs);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        savedCallback.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [delayMs]);
}
