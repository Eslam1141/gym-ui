// Asserts the MERGED Android manifest declares exactly the six read-only Health Connect
// permissions (release) or those six plus the six debug-only WRITE ones (debug), and
// nothing else under android.permission.health.*. Also checks CAMERA stays undeclared.
//
//   cd android && ./gradlew processReleaseMainManifest processDebugMainManifest
//   node tools/check-manifest.mjs            # checks both merged manifests
import { readFileSync, existsSync } from 'node:fs';

const base = new URL('../android/app/build/intermediates/merged_manifest/', import.meta.url);
const READ = ['ACTIVE_CALORIES_BURNED', 'HEART_RATE', 'RESTING_HEART_RATE', 'SLEEP', 'STEPS', 'WEIGHT'].map((n) => `READ_${n}`);
const WRITE = READ.map((n) => n.replace('READ_', 'WRITE_'));
const expected = { release: READ, debug: [...READ, ...WRITE] };

let failed = false;
for (const [variant, want] of Object.entries(expected)) {
  const path = new URL(`${variant}/process${variant[0].toUpperCase()}${variant.slice(1)}MainManifest/AndroidManifest.xml`, base);
  if (!existsSync(path)) { console.error(`missing ${path.pathname} (build it first)`); failed = true; continue; }
  const xml = readFileSync(path, 'utf8');
  // Only <uses-permission> lines; a tools:node="remove" marker never survives into the merged file.
  const perms = [...xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]);
  const health = perms.filter((p) => p.startsWith('android.permission.health.')).map((p) => p.split('.').pop()).sort();
  const ok = JSON.stringify(health) === JSON.stringify([...want].sort());
  const camera = perms.includes('android.permission.CAMERA');
  console.log(`${variant}: ${health.join(', ')} ${ok && !camera ? 'OK' : 'FAIL'}`);
  if (!ok || camera) failed = true;
}
process.exit(failed ? 1 : 0);
