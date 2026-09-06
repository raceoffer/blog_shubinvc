// Decodes base64-encoded binary assets from assets-src/ into public/.
// Needed because binary files can't be pushed through some Git clients/APIs —
// the .b64 text files travel safely, this script restores the originals
// before every `npm run dev` / `npm run build`.
// Large files may be split into sequential parts: name.ext.b64.part1, .part2, ...
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../assets-src/', import.meta.url).pathname;
const OUT = new URL('../public/', import.meta.url).pathname;

if (!existsSync(SRC)) process.exit(0);

const files = readdirSync(SRC);
// Group whole .b64 files and .b64.partN sequences by their target name.
const targets = new Map();
for (const f of files) {
  const m = f.match(/^(.*?)\.b64(?:\.part(\d+))?$/);
  if (!m) continue;
  const [, name, part] = m;
  if (!targets.has(name)) targets.set(name, []);
  targets.get(name).push({ file: f, part: part ? Number(part) : 0 });
}

for (const [name, entries] of targets) {
  entries.sort((a, b) => a.part - b.part);
  const b64 = entries.map((e) => readFileSync(join(SRC, e.file), 'utf8')).join('').replace(/\s/g, '');
  writeFileSync(join(OUT, name), Buffer.from(b64, 'base64'));
  console.log(`[assets] decoded ${entries.map((e) => e.file).join(' + ')} -> public/${name}`);
}
