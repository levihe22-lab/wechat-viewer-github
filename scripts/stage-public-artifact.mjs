import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const ALLOWED_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.mjs', '.json',
  '.svg', '.png', '.ico', '.txt',
]);

async function* walkSource(dir, rel = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.name.startsWith('.') && entry.name !== '.gitkeep') continue;
    if (entry.isSymbolicLink()) {
      console.error(`STAGE_REJECT_SYMLINK: ${relPath}`);
      process.exit(1);
    }
    if (entry.isDirectory()) {
      yield* walkSource(full, relPath);
    } else if (entry.name === '.gitkeep') {
      continue;
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        console.error(`STAGE_REJECT_TYPE: ${relPath} (${ext})`);
        process.exit(1);
      }
      yield { full, rel: relPath };
    }
  }
}

async function main() {
  const src = path.join(ROOT, 'public');
  const dest = path.join(ROOT, '.stage-public');

  // Remove previous staging
  await rm(dest, { recursive: true, force: true }).catch(() => {});
  await mkdir(dest, { recursive: true });

  for await (const { full, rel } of walkSource(src)) {
    const target = path.join(dest, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(full, target);
  }

  console.log(`STAGE_OK: ${dest}`);
}

main().catch((err) => {
  console.error('STAGE_FAILED');
  process.exit(2);
});
