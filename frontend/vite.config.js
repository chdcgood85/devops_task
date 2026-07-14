import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The built assets are served by Django/WhiteNoise under /static/, so Vite has
// to prefix asset URLs with that path. During `vite dev` the base is "/" and a
// proxy forwards /api to the Django dev server on :5000.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/static/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    // Always emit JUnit XML (not just when CI is detected) so CircleCI's
    // store_test_results can never silently find nothing. The console reporter
    // still prints the usual human-readable output.
    reporters: ["default", "junit"],
    outputFile: { junit: "./test-results/junit.xml" },
  },
}));
