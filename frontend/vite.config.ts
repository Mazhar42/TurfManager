import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.svg"],
      manifest: {
        name: "Turf Manager",
        short_name: "TurfManager",
        description: "Booking, customers, payments and reports for your turf.",
        theme_color: "#0b7a3d",
        background_color: "#0b0f0d",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icons/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the app shell and the last-seen dashboard/availability reads so a dead
        // zone in the field office still shows the day's bookings. Writes are never
        // queued offline — see lib/api.ts.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && (url.pathname.includes("/availability") || url.pathname.includes("/reports/daily")),
            handler: "NetworkFirst",
            options: {
              cacheName: "turf-reads",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 8000 is taken by another local project's container on this machine, so the
      // backend runs on 8010 in dev — see README.
      "/api": { target: "http://127.0.0.1:8010", changeOrigin: true },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: "charts", test: /node_modules\/recharts|node_modules\/d3-/ },
            { name: "vendor", test: /node_modules/ },
          ],
        },
      },
    },
  },
});
