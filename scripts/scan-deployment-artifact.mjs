import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const BANNED_EXTENSIONS = new Set([
  '.wcv', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov',
  '.m4a', '.mp3', '.wav', '.amr', '.silk',
  '.db', '.sqlite', '.sqlite3',
]);

const BANNED_NAMES = new Set([
  'wechat-viewer-private', 'private-data', 'test-fixtures',
  'tools', 'exports', '打包WCV3.bat', '打包WCV3.command',
]);

const BANNED_PATTERNS = [
  // Local absolute paths
  { pattern: /[A-Za-z]:\\claude code\\/gi, code: 'LEAK_LOCAL_PATH' },
  // Private tool references
  { pattern: /\bwechat-viewer-private\b/g, code: 'LEAK_PRIVATE_DIR' },
  // Sensitive data patterns
  { pattern: /\bpassword\s*[:=]\s*["'][^"'\s]{3,}["']/gi, code: 'LEAK_PASSWORD' },
];

async function* walkDir(dir, rel = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;

    if (entry.isSymbolicLink()) {
      console.error(`LEAK_SYMLINK: ${relPath}`);
      process.exit(1);
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (BANNED_EXTENSIONS.has(ext)) {
      console.error(`LEAK_BANNED_EXT: ${relPath}`);
      process.exit(1);
    }
    if (BANNED_NAMES.has(entry.name)) {
      console.error(`LEAK_BANNED_NAME: ${relPath}`);
      process.exit(1);
    }

    if (entry.isDirectory()) {
      yield* walkDir(full, relPath);
    } else if (/\.(?:html|css|js|mjs|json|svg|txt|md)$/.test(entry.name)) {
      yield { full, rel: relPath };
    }
  }
}

async function main() {
  const targetDir = process.argv[2] || path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..', '.stage-public',
  );

  let hitCount = 0;
  for await (const { full, rel } of walkDir(targetDir)) {
    const text = await readFile(full, 'utf-8');
    for (const { pattern, code } of BANNED_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        console.error(`${code}: ${rel}`);
        hitCount += 1;
      }
    }
  }

  if (hitCount > 0) {
    console.error(`LEAK_SCAN_FAILED: ${hitCount} hit(s)`);
    process.exit(1);
  }

  console.log('LEAK_SCAN_OK');
}

main().catch((err) => {
  console.error('LEAK_SCAN_ERROR');
  process.exit(2);
});
