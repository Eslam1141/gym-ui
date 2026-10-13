// check-exercise-videos.mjs — checks every exercise video in app.js.
//
// For each unique `vid` (YouTube id) it fetches the public watch page and
// reports its length, whether it plays and whether it can be embedded. Exits
// 1 if any exercise has no video, or a video is missing, private, not
// embeddable or longer than the limit. Needs network, so it's a manual check,
// not part of the Playwright suite.
//
//   node tools/check-exercise-videos.mjs            # limit 90 s
//   node tools/check-exercise-videos.mjs --max 60
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const maxArg = process.argv.indexOf("--max");
const MAX = maxArg > -1 ? Number(process.argv[maxArg + 1]) : 90;
const src = readFileSync(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

// exercise name -> set of vids (the same exercise appears in several day lists)
const byName = new Map();
for (const m of src.matchAll(/\{id:"[^"]+",\s*en:"([^"]+)"[^}]*\}/g)) {
  const vid = (m[0].match(/vid:"([^"]*)"/) || [])[1] || "";
  if (!byName.has(m[1])) byName.set(m[1], new Set());
  byName.get(m[1]).add(vid);
}

async function probe(vid) {
  const res = await fetch(`https://www.youtube.com/watch?v=${vid}&hl=en`, { headers: { "Accept-Language": "en" } });
  const html = await res.text();
  return {
    len: Number((html.match(/"lengthSeconds":"(\d+)"/) || [])[1]),
    status: (html.match(/"playabilityStatus":\{"status":"(\w+)"/) || [])[1] || "UNKNOWN",
    embed: (html.match(/"playableInEmbed":(true|false)/) || [])[1] === "true"
  };
}

const seen = new Map();
const problems = [];
for (const [name, vids] of byName) {
  for (const vid of vids) {
    if (!vid) { problems.push(`${name}: no video`); continue; }
    if (!seen.has(vid)) seen.set(vid, await probe(vid));
    const p = seen.get(vid);
    const line = `${String(p.len || "?").padStart(4)}s  ${vid}  ${name}`;
    if (p.status !== "OK") problems.push(`${line}  (status ${p.status})`);
    else if (!p.embed) problems.push(`${line}  (not embeddable)`);
    else if (!(p.len <= MAX)) problems.push(`${line}  (over ${MAX}s)`);
    else console.log(line);
  }
}

console.log(`\n${byName.size} exercises, ${seen.size} videos, limit ${MAX}s`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n` + problems.join("\n"));
  process.exit(1);
}
console.log("all videos OK");
