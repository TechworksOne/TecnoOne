import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: [
      "tecnocell.techworksone.com",
      "localhost",
      "127.0.0.1",
    ],
    hmr: false,
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
});
