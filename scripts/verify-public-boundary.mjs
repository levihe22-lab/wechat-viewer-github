import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED_ROOT_ENTRIES = new Set(['.git', 'node_modules', '.stage-public']);
const FORBIDDEN_DIRECTORY_NAMES = new Set([
  'private-data',
  'test-fixtures',
  'exports',
  'wechat-viewer-private',
]);
const FORBIDDEN_EXTENSIONS = new Set([
  '.wcv', '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar',
  '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.mp3', '.m4a', '.aac', '.wav', '.amr', '.ogg',
]);
const TEXT_EXTENSIONS = new Set([
  '', '.css', '.html', '.js', '.json', '.md', '.mjs', '.txt', '.xml', '.yml', '.yaml',
]);
const MAX_TEXT_SCAN_BYTES = 2 * 1024 * 1024;

export class PublicBoundaryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicBoundaryError';
    this.code = code;
  }
}

function fail(code) {
  throw new PublicBoundaryError(code);
}

function validateRelativeName(relativeName) {
  const normalized = relativeName.replaceAll('\\', '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) fail('BOUNDARY_PATH_ESCAPE');
  if (segments.some((segment) => FORBIDDEN_DIRECTORY_NAMES.has(segment.toLowerCase()))) {
    fail('BOUNDARY_PRIVATE_PATH');
  }
  const extension = path.extname(normalized).toLowerCase();
  if (FORBIDDEN_EXTENSIONS.has(extension)) fail('BOUNDARY_FORBIDDEN_FILE');
  if (/^(?:wxid_|messages?$|media$)/iu.test(path.basename(normalized, extension))) {
    fail('BOUNDARY_PERSONAL_PATH_PATTERN');
  }
}

async function scanTextFile(rootPath, filePath) {
  const stats = await lstat(filePath);
  if (stats.size > MAX_TEXT_SCAN_BYTES) fail('BOUNDARY_TEXT_TOO_LARGE');
  const text = await readFile(filePath, 'utf8');
  const parentReferences = text.matchAll(/(?:^|["'\s=(])(\.\.[\\/][A-Za-z0-9_.\\/-]*)/gmu);
  for (const match of parentReferences) {
    const resolvedReference = path.resolve(path.dirname(filePath), match[1]);
    if (resolvedReference !== rootPath && !resolvedReference.startsWith(`${rootPath}${path.sep}`)) {
      fail('BOUNDARY_PARENT_REFERENCE');
    }
  }
  if (/(?:[A-Za-z]:\\|\/Users\/|\/home\/)/u.test(text)) fail('BOUNDARY_LOCAL_PATH');
  if (/\bwxid_[A-Za-z0-9_-]+\b/u.test(text)) fail('BOUNDARY_PERSONAL_CONTENT_PATTERN');
}

async function walk(rootPath, currentPath) {
  const entries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (currentPath === rootPath && IGNORED_ROOT_ENTRIES.has(entry.name)) continue;
    const fullPath = path.join(currentPath, entry.name);
    const relativeName = path.relative(rootPath, fullPath);
    validateRelativeName(relativeName);

    const stats = await lstat(fullPath);
    if (stats.isSymbolicLink()) fail('BOUNDARY_SYMBOLIC_LINK');
    if (stats.isDirectory()) {
      await walk(rootPath, fullPath);
      continue;
    }
    if (!stats.isFile()) fail('BOUNDARY_SPECIAL_FILE');

    const extension = path.extname(entry.name).toLowerCase();
    if (TEXT_EXTENSIONS.has(extension)) await scanTextFile(rootPath, fullPath);
  }
}

export async function verifyPublicBoundary(candidateRoot) {
  if (!candidateRoot || typeof candidateRoot !== 'string') fail('BOUNDARY_INVALID_ROOT');
  const absoluteRoot = path.resolve(candidateRoot);
  const rootStats = await lstat(absoluteRoot).catch(() => null);
  if (!rootStats?.isDirectory() || rootStats.isSymbolicLink()) fail('BOUNDARY_INVALID_ROOT');
  const canonicalRoot = await realpath(absoluteRoot);
  if (canonicalRoot !== absoluteRoot) fail('BOUNDARY_INVALID_ROOT');
  await walk(absoluteRoot, absoluteRoot);
  return { filesSafe: true };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    await verifyPublicBoundary(repositoryRoot);
    process.stdout.write('BOUNDARY_OK\n');
  } catch (error) {
    const code = error instanceof PublicBoundaryError ? error.code : 'BOUNDARY_INTERNAL_ERROR';
    process.stderr.write(`BOUNDARY_FAIL ${code}\n`);
    process.exitCode = 1;
  }
}
