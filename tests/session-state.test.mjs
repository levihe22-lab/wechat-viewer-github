import assert from 'node:assert/strict';
import test from 'node:test';

import { SessionController } from '../public/assets/session-controller.js';
import { canTransition, SESSION_STATE } from '../public/assets/session-state.js';
import { UI_MESSAGES } from '../public/assets/ui-renderer.js';

class RecordingRenderer {
  constructor() {
    this.calls = [];
    this.inputClearCount = 0;
  }

  render(state, message) {
    this.calls.push({ state, message });
  }

  clearInputs() {
    this.inputClearCount += 1;
  }

  visibleText() {
    return this.calls.map(({ message }) => message ?? '').join(' ');
  }
}

function syntheticFile(name = 'package.wcv') {
  return Object.freeze({ name, size: 64 });
}

function authenticatedSession() {
  return {
    sessionKey: Object.freeze({ type: 'secret' }),
    manifest: Object.freeze({ resources: [] }),
    decryptedResources: new Map(),
    temporaryUrls: new Set(),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

test('transition table allows only the designed state edges', () => {
  const allowed = new Set([
    'locked:importing',
    'importing:unlocked',
    'importing:clearing',
    'unlocked:clearing',
    'clearing:locked',
  ]);

  for (const from of Object.values(SESSION_STATE)) {
    for (const to of Object.values(SESSION_STATE)) {
      assert.equal(canTransition(from, to), allowed.has(`${from}:${to}`), `${from} -> ${to}`);
    }
  }
});

test('missing or incorrectly suffixed files remain locked with generic prompts', async () => {
  const renderer = new RecordingRenderer();
  let factoryCalls = 0;
  const controller = new SessionController(renderer, {
    createSession: async () => { factoryCalls += 1; return authenticatedSession(); },
  });

  assert.equal(await controller.beginImport(undefined, 'password'), false);
  assert.equal(await controller.beginImport(syntheticFile('package.txt'), 'password'), false);
  assert.equal(controller.state, SESSION_STATE.LOCKED);
  assert.equal(factoryCalls, 0);
  assert.equal(renderer.calls.at(-1).message, UI_MESSAGES.FILE_REQUIRED);
  assert.deepEqual(controller.snapshot(), {
    state: SESSION_STATE.LOCKED,
    hasFile: false,
    hasSessionKey: false,
    hasManifest: false,
    decryptedResourceCount: 0,
    temporaryUrlCount: 0,
  });
});

test('successful authenticated import is the only path to unlocked', async () => {
  const renderer = new RecordingRenderer();
  const transitions = [];
  const controller = new SessionController(renderer, {
    createSession: async () => authenticatedSession(),
    onTransition: (from, to) => transitions.push(`${from}:${to}`),
  });

  assert.equal(await controller.beginImport(syntheticFile(), 'password'), true);
  assert.equal(controller.state, SESSION_STATE.UNLOCKED);
  assert.deepEqual(transitions, ['locked:importing', 'importing:unlocked']);
  assert.deepEqual(controller.snapshot(), {
    state: SESSION_STATE.UNLOCKED,
    hasFile: true,
    hasSessionKey: true,
    hasManifest: true,
    decryptedResourceCount: 0,
    temporaryUrlCount: 0,
  });

  controller.lock();
  assert.equal(controller.state, SESSION_STATE.LOCKED);
  assert.deepEqual(transitions.slice(-2), ['unlocked:clearing', 'clearing:locked']);
  assert.equal(controller.snapshot().hasFile, false);
  assert.equal(controller.snapshot().hasSessionKey, false);
  assert.equal(controller.snapshot().hasManifest, false);
});

test('import failure passes through clearing and does not expose error details', async () => {
  const sentinel = 'SYNTHETIC_PRIVATE_SENTINEL';
  const renderer = new RecordingRenderer();
  const transitions = [];
  const controller = new SessionController(renderer, {
    createSession: async () => { throw new Error(sentinel); },
    onTransition: (from, to) => transitions.push(`${from}:${to}`),
  });

  assert.equal(await controller.beginImport(syntheticFile(), 'password'), false);
  assert.deepEqual(transitions, [
    'locked:importing',
    'importing:clearing',
    'clearing:locked',
  ]);
  assert.equal(controller.state, SESSION_STATE.LOCKED);
  assert.equal(renderer.calls.at(-1).message, UI_MESSAGES.FAILURE);
  assert.doesNotMatch(renderer.visibleText(), new RegExp(sentinel, 'u'));
  assert.equal(controller.snapshot().hasFile, false);
  assert.equal(controller.snapshot().hasSessionKey, false);
});

test('cancelled import cannot unlock when its asynchronous result arrives', async () => {
  const pending = deferred();
  const renderer = new RecordingRenderer();
  const controller = new SessionController(renderer, {
    createSession: () => pending.promise,
  });

  const importResult = controller.beginImport(syntheticFile(), 'password');
  assert.equal(controller.state, SESSION_STATE.IMPORTING);
  assert.equal(controller.cancelImport(), true);
  assert.equal(controller.state, SESSION_STATE.LOCKED);

  const staleCandidate = authenticatedSession();
  pending.resolve(staleCandidate);
  assert.equal(await importResult, false);
  assert.equal(controller.state, SESSION_STATE.LOCKED);
  assert.equal(staleCandidate.sessionKey, null);
  assert.equal(staleCandidate.manifest, null);
});

test('starting another import clears an unlocked session before importing', async () => {
  const renderer = new RecordingRenderer();
  const transitions = [];
  const controller = new SessionController(renderer, {
    createSession: async () => authenticatedSession(),
    onTransition: (from, to) => transitions.push(`${from}:${to}`),
  });

  await controller.beginImport(syntheticFile(), 'first-password');
  await controller.beginImport(syntheticFile('next.WCV'), 'second-password');

  assert.equal(controller.state, SESSION_STATE.UNLOCKED);
  assert.deepEqual(transitions, [
    'locked:importing',
    'importing:unlocked',
    'unlocked:clearing',
    'clearing:locked',
    'locked:importing',
    'importing:unlocked',
  ]);
  assert.equal(renderer.inputClearCount, 1);
});
