import { defineConfig } from "vite";

// In dev, proxy /api to the backend so there are no CORS surprises.
// For production builds, set VITE_API to the backend origin.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.MARKET_SIG_BACKEND || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
