import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  PublicBoundaryError,
  verifyPublicBoundary,
} from '../scripts/verify-public-boundary.mjs';

async function withFixture(run) {
  const parent = await mkdtemp(path.join(tmpdir(), 'public-boundary-'));
  const publicRoot = path.join(parent, 'public-repository');
  await mkdir(publicRoot);
  try {
    await run({ parent, publicRoot });
  } finally {
    await rm(parent, { force: true, recursive: true });
  }
}

async function expectCode(root, expectedCode) {
  await assert.rejects(
    verifyPublicBoundary(root),
    (error) => error instanceof PublicBoundaryError
      && error.code === expectedCode
      && error.message === expectedCode,
  );
}

test('accepts a synthetic generic static shell without inspecting its sibling', async () => {
  await withFixture(async ({ parent, publicRoot }) => {
    await mkdir(path.join(publicRoot, 'public', 'assets'), { recursive: true });
    await writeFile(path.join(publicRoot, 'public', 'index.html'), '<script src="./assets/app.js"></script>');
    await writeFile(path.join(publicRoot, 'public', 'assets', 'app.js'), 'export const state = "locked";');
    await mkdir(path.join(parent, 'private-sibling'));
    await writeFile(path.join(parent, 'private-sibling', 'sentinel.wcv'), new Uint8Array([1, 2, 3]));

    assert.deepEqual(await verifyPublicBoundary(publicRoot), { filesSafe: true });
  });
});

test('rejects synthetic WCV files without exposing names or contents', async () => {
  await withFixture(async ({ publicRoot }) => {
    await writeFile(path.join(publicRoot, 'sample.wcv'), new Uint8Array([7, 8, 9]));
    await expectCode(publicRoot, 'BOUNDARY_FORBIDDEN_FILE');
  });
});

test('rejects private directory names', async () => {
  await withFixture(async ({ publicRoot }) => {
    await mkdir(path.join(publicRoot, 'private-data'));
    await expectCode(publicRoot, 'BOUNDARY_PRIVATE_PATH');
  });
});

test('rejects parent-directory references in public text', async () => {
  await withFixture(async ({ publicRoot }) => {
    await writeFile(path.join(publicRoot, 'app.js'), 'const unsafe = "../outside";');
    await expectCode(publicRoot, 'BOUNDARY_PARENT_REFERENCE');
  });
});

test('rejects unexpected media exports', async () => {
  await withFixture(async ({ publicRoot }) => {
    await writeFile(path.join(publicRoot, 'synthetic-video.mp4'), new Uint8Array([0, 1]));
    await expectCode(publicRoot, 'BOUNDARY_FORBIDDEN_FILE');
  });
});

test('rejects links before traversing their targets', async (context) => {
  await withFixture(async ({ parent, publicRoot }) => {
    const outside = path.join(parent, 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'generic.txt'), 'not scanned');
    try {
      await symlink(outside, path.join(publicRoot, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (error && ['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) {
        context.skip('Link creation is unavailable in this environment');
        return;
      }
      throw error;
    }
    await expectCode(publicRoot, 'BOUNDARY_SYMBOLIC_LINK');
  });
});
