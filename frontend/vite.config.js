import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "browser-dom",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.js"],
          include: ["src/**/*.test.{js,jsx}"],
          exclude: ["src/tokens/pipeline.test.js"],
        },
      },
      {
        extends: true,
        test: {
          name: "token-pipeline",
          environment: "node",
          include: ["src/tokens/pipeline.test.js"],
        },
      },
    ],
  },
});
