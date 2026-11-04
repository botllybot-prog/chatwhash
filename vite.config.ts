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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Images are kept on the phone after the first view, so returning to a
        // page shows them instantly and without data, even on a weak signal.
        runtimeCaching: [
          {
            // Offer and chat media: keys are unique and never overwritten.
            urlPattern: ({ url, request }) =>
              request.destination === "image" &&
              (url.pathname.startsWith("/api/offer-media/") || url.pathname.startsWith("/api/chat-media/")),
            handler: "CacheFirst",
            options: {
              cacheName: "media-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Station photos in Supabase Storage (public bucket URLs).
            urlPattern: ({ url, request }) =>
              request.destination === "image" && url.pathname.includes("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: {
              cacheName: "storage-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              // 0 covers opaque cross-origin responses from <img> without CORS.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Maps tiles and marker images.
            urlPattern: ({ url, request }) =>
              request.destination === "image" && /(^|\.)(googleapis|gstatic)\.com$/.test(url.hostname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "map-images",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
  build: {
    rollupOptions: {
      output: {
        // Keep core libraries in their own long-lived chunks so they stay
        // cached across deploys. Maps/charts are left to Rollup so they only
        // load with the lazy pages that use them.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "vendor-motion";
          if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return "vendor-supabase";
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
