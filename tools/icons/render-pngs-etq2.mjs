// Rasterise the Etqadem v2 SVGs (from gen-etq2-svgs.py) to the PNG icon set and favicon-etq2.ico with headless Chromium,
// so the PNGs match the browser SVG rendering exactly. favicon-48-etq2.png is an intermediate (ico only).
// Run: PLAYWRIGHT_CORE=<path to playwright-core> node tools/icons/render-pngs-etq2.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright");
const ICONS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "icons");
const PAPER = "#F3F0E8";
const NIGHT = "#10171f";
const NATIVE = join(ICONS, "..", "native", "assets");

// [source svg, output png, size, opaque background?]
const JOBS = [
  ["logo-etq2.svg", "icon-192-etq2.png", 192],
  ["logo-etq2.svg", "icon-512-etq2.png", 512],
  ["logo-etq2.svg", "favicon-48-etq2.png", 48],
  ["logo-etq2-maskable.svg", "icon-maskable-192-etq2.png", 192],
  ["logo-etq2-maskable.svg", "icon-maskable-512-etq2.png", 512],
  ["logo-etq2-maskable.svg", "apple-touch-icon-etq2.png", 180, PAPER],
  ["logo-etq2.svg", "favicon-32-etq2.png", 32],
  ["logo-etq2-tiny.svg", "favicon-16-etq2.png", 16],
  ["logo-etq2-mono.svg", "icon-mono-96-etq2.png", 96],
  ["logo-etq2-android-fg.svg", "android/ic-launcher-foreground-etq2-432.png", 432],
  ["logo-etq2-android-mono.svg", "android/ic-launcher-monochrome-etq2-432.png", 432],
  [null, "android/ic-launcher-background-etq2-432.png", 432, PAPER],
  // Capacitor sources (native/assets), fed to `npx capacitor-assets generate` (see native/README.md).
  ["logo-etq2-maskable.svg", "@native/icon-only.png", 1024, PAPER],
  ["logo-etq2-android-fg.svg", "@native/icon-foreground.png", 1024],
  [null, "@native/icon-background.png", 1024, PAPER],
  ["logo-etq2-ondark.svg", "@native/splash.png", 2732, NIGHT, 0.2],
  ["logo-etq2-ondark.svg", "@native/splash-dark.png", 2732, NIGHT, 0.2],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size, bg, frac] of JOBS) {
  // frac: draw the mark at that fraction of the canvas, centred (splash screens).
  const m = Math.round(size * (frac || 1));
  const svg = src ? readFileSync(join(ICONS, src), "utf8").replace("<svg ", `<svg width="${m}" height="${m}" `) : "";
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:flex;` +
    `align-items:center;justify-content:center;background:${bg || "transparent"}">${svg}</body></html>`);
  const path = out.startsWith("@native/") ? join(NATIVE, out.slice(8)) : join(ICONS, out);
  await page.screenshot({ path, omitBackground: !bg, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote", out);
}
await browser.close();

// favicon-etq2.ico: PNG-embedded 16 (tiny variant), 32 and 48 entries
const sizes = [[16, "favicon-16-etq2.png"], [32, "favicon-32-etq2.png"], [48, "favicon-48-etq2.png"]];
const pngs = sizes.map(([, f]) => readFileSync(join(ICONS, f)));
const head = Buffer.alloc(6 + 16 * pngs.length);
head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
let off = head.length;
sizes.forEach(([n], i) => {
  const e = 6 + 16 * i;
  head[e] = n; head[e + 1] = n; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(off, e + 12); off += pngs[i].length;
});
writeFileSync(join(ICONS, "favicon-etq2.ico"), Buffer.concat([head, ...pngs]));
unlinkSync(join(ICONS, "favicon-48-etq2.png"));
console.log("wrote favicon-etq2.ico");
