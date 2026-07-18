import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const BANNED_PATTERNS = [
  // Network APIs
  { pattern: /\bfetch\s*\(/g, code: 'E_NET_FETCH' },
  { pattern: /\bXMLHttpRequest\b/g, code: 'E_NET_XHR' },
  { pattern: /\bWebSocket\b/g, code: 'E_NET_WS' },
  { pattern: /\bsendBeacon\s*\(/g, code: 'E_NET_BEACON' },
  { pattern: /\bnavigator\.sendBeacon\b/g, code: 'E_NET_BEACON' },
  // External preconnect / prefetch
  { pattern: /rel=["'](?:preconnect|prefetch|dns-prefetch|prerender)["']/g, code: 'E_PREFETCH' },
  // Persistence APIs
  { pattern: /\blocalStorage\b/g, code: 'E_PERSIST_LS' },
  { pattern: /\bsessionStorage\b/g, code: 'E_PERSIST_SS' },
  { pattern: /\bindexedDB\b/g, code: 'E_PERSIST_IDB' },
  { pattern: /\bopenDatabase\s*\(/g, code: 'E_PERSIST_WEBSQL' },
  { pattern: /\bcaches\./g, code: 'E_PERSIST_CACHE' },
  { pattern: /\bdocument\.cookie\b/g, code: 'E_PERSIST_COOKIE' },
  // Service Worker
  { pattern: /\bserviceWorker\b/g, code: 'E_SW' },
  { pattern: /\bnavigator\.serviceWorker\b/g, code: 'E_SW' },
  // Persistent file handles
  { pattern: /\bshow(?:Open|Save)FilePicker\s*\(/g, code: 'E_FILE_PICKER' },
  { pattern: /\bFileSystemFileHandle\b/g, code: 'E_FILE_HANDLE' },
  // Root-absolute paths (except blob:)
  { pattern: /(?<!["'])(?:\b(src|href|action|url)\s*=\s*["'])\/(?!\/)/g, code: 'E_ROOT_PATH' },
  // External URLs in auto-load attributes (src/action auto-fetch; <a href> is user-click only)
  { pattern: /\b(?:src|action)\s*=\s*["']https?:\/\//g, code: 'E_EXTERNAL_RESOURCE' },
  { pattern: /<link\b[^>]*href\s*=\s*["']https?:\/\//g, code: 'E_EXTERNAL_RESOURCE' },
  // Inline event handlers
  { pattern: /\bon\w+\s*=\s*["']/g, code: 'E_INLINE_HANDLER' },
];

function scanText(text, filePath) {
  const hits = [];
  for (const { pattern, code } of BANNED_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      hits.push({ code, position: match.index, file: filePath });
    }
  }
  return hits;
}

async function* walkDir(dir, rel = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      yield* walkDir(full, relPath);
    } else if (/\.(?:html|js|mjs|css)$/.test(entry.name)) {
      yield { full, rel: relPath };
    }
  }
}

async function main() {
  const publicDir = path.join(ROOT, 'public');
  let hitCount = 0;

  for await (const { full, rel } of walkDir(publicDir)) {
    const text = await readFile(full, 'utf-8');
    const hits = scanText(text, rel);
    for (const hit of hits) {
      console.error(`${hit.code}: ${hit.file}`);
      hitCount += 1;
    }
  }

  if (hitCount > 0) {
    console.error(`AUDIT_FAILED: ${hitCount} banned pattern(s)`);
    process.exit(1);
  }

  console.log('AUDIT_OK');
}

main().catch((err) => {
  console.error('AUDIT_ERROR');
  process.exit(2);
});
