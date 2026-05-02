import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon-512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "واشلي — حجز غسيل السيارات",
        short_name: "واشلي",
        description: "منصة ذكية لحجز مواعيد غسيل السيارات عبر واتساب",
        dir: "rtl",
        lang: "ar",
        theme_color: "#0891b2",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/map",
        scope: "/",
        icons: [
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
