const { defineConfig } = require("@playwright/test");

// Serves the repo root (parent dir) statically; no build step.
module.exports = defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  // At 8 workers a worker's first page.goto sometimes never sees `load`
  // (seen on main too, 2026-10-08); 4 is reliable on a 16-thread laptop.
  workers: 4,
  webServer: {
    command: "python static-server.py 4173 ..",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "ignore"
  },
  use: { baseURL: "http://127.0.0.1:4173" }
});
