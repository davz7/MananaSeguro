import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: './src/setupTests.js',
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "src/main.jsx",
        "src/index.css",
        "**/*.test.js",
        "**/*.test.jsx",
        "**/dist/**",
      ],
    },
  },
  server: {
    allowedHosts: ["step-trimming-ecology.ngrok-free.dev"],
    proxy: {
      // Proxy específico para cetes-rate
      "/api/cetes-rate": {
        target: "https://stablebonds.etherfuse.com",
        changeOrigin: true,
        rewrite: () => "/bonds", // siempre va a /bonds sin importar el path
      },
      // Proxy para la Ramp API (nuevo)
      "/api/etherfuse-ramp": {
        target: "http://localhost:8888",
        changeOrigin: true,
      },
    },
  },
});
