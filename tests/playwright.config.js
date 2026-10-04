const { defineConfig } = require("@playwright/test");

// Serves the repo root (parent dir) statically; no build step.
module.exports = defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  webServer: {
    command: "python -m http.server 4173 --directory ..",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "ignore"
  },
  use: { baseURL: "http://127.0.0.1:4173" }
});
