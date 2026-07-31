import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let isRefreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isRefreshing) return;

    isRefreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
