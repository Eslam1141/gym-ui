const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// nginx's CSP allows inline scripts only by hash. Editing an inline <script>
// in index.html without updating docker/security-headers.conf silently blocks
// it in production (the early-paint script was blocked this way), so every
// inline script's hash must be listed.
test("every inline script in index.html is allowed by the CSP hash list", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const conf = fs.readFileSync(path.join(root, "docker", "security-headers.conf"), "utf8");
  const listed = new Set(conf.match(/sha256-[A-Za-z0-9+/=]+/g) || []);
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) =>
    "sha256-" + crypto.createHash("sha256").update(m[1]).digest("base64"));
  expect(inline.length).toBeGreaterThan(0);
  for (const h of inline) expect(listed, `CSP is missing ${h}`).toContain(h);
});
