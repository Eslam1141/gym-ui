const { defineConfig } = require("@playwright/test");

// Serves the repo root (parent dir) statically; no build step.
const PORT = process.env.PW_PORT || 4173; // other agents/worktrees pick their own port

module.exports = defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  // At 8 workers a worker's first page.goto sometimes never sees `load`
  // (seen on main too, 2026-10-08); 4 is reliable on a 16-thread laptop.
  workers: 4,
  webServer: {
    command: `python static-server.py ${PORT} ..`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "ignore"
  },
  use: { baseURL: `http://127.0.0.1:${PORT}` }
});
