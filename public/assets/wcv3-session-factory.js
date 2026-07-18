import { Wcv3RangeReader } from './wcv3-range-reader.js';
import { deriveSessionKey, decryptManifest } from './wcv3-crypto.js';
import { ManifestPlanner } from './manifest-planner.js';

/**
 * Real WCV3 session factory — wires header read, PBKDF2 key derivation,
 * manifest authentication, and planner construction into the shape
 * expected by SessionController.
 *
 * Design: requirements 2.1, 2.4, 3.6, 4.1; tasks 4, 4.1
 */
export async function createWcv3Session(file, password) {
  const reader = new Wcv3RangeReader(file);
  const header = await reader.readHeader();
  const key = await deriveSessionKey(password, header.salt);

  let manifest;
  try {
    manifest = await decryptManifest(reader, header, key);
  } catch (err) {
    // key material is non-extractable; release the reader reference on failure
    reader.clear();
    throw err;
  }

  const manifestRange = Object.freeze({
    offset: header.manifestOffset,
    length: header.manifestLength,
  });
  const planner = new ManifestPlanner(manifest, file.size, manifestRange);

  return Object.freeze({
    sessionKey: key,
    manifest,
    planner,
    reader,
    header,
    decryptedResources: new Map(),
    temporaryUrls: new Set(),
  });
}
