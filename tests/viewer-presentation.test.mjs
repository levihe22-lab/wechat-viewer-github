import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createApp } from '../public/assets/app.js';
import { SESSION_STATE } from '../public/assets/session-state.js';
import { UI_MESSAGES } from '../public/assets/ui-renderer.js';
import * as viewer from '../public/assets/viewer.js';

const viewerUrl = new URL('../public/assets/viewer.js', import.meta.url);
const appUrl = new URL('../public/assets/app.js', import.meta.url);

const TRANSIENT_SELECTORS = Object.freeze([
  '#search-panel',
  '#date-panel',
  '#image-overlay',
  '#video-overlay',
  '#menu-dropdown',
  '#search-bar',
  '#load-more',
]);

const VIEWER_SELECTORS = Object.freeze([
  '#locked-view',
  '#app-view',
  '#status',
  '#package-file',
  '#package-password',
  '#unlock-button',
  '#cancel-button',
  '#lock-button',
  '#topbar-name',
  '#btn-menu',
  '#menu-dropdown',
  '#menu-date',
  '#menu-search',
  '#search-bar',
  '#search-input',
  '#btn-search-clear',
  '#btn-search-close',
  '#search-panel',
  '#search-list',
  '#search-panel-close',
  '#search-result-title',
  '#chat-area',
  '#messages-list',
  '#load-more',
  '#btn-load-more',
  '#empty-hint',
  '#image-overlay',
  '#image-preview',
  '#image-close',
  '#video-overlay',
  '#video-preview',
  '#video-close',
  '#date-panel',
  '#date-year-month',
  '#date-grid',
  '#date-prev-month',
  '#date-next-month',
  '#date-close-btn',
  '#date-jump-latest',
]);

class SyntheticClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(...names) {
    for (const name of names) this.names.add(name);
  }

  remove(...names) {
    for (const name of names) this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }
}

class SyntheticStyle {
  constructor() {
    this.overflow = '';
    this.display = '';
  }

  removeProperty(name) {
    const previous = this[name] ?? '';
    this[name] = '';
    return previous;
  }
}

class SyntheticElement {
  constructor() {
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
    this.files = [];
    this.innerHTML = '';
    this.dataset = {};
    this.style = new SyntheticStyle();
    this.classList = new SyntheticClassList();
    this.listeners = new Map();
    this.attributes = new Map();
    this.children = [];
    this.paused = true;
    this.pauseCalls = 0;
    this.playCalls = 0;
    this.loadCalls = 0;
    this.scrollTop = 0;
    this.scrollHeight = 0;
  }

  get src() {
    return this.attributes.get('src') ?? '';
  }

  set src(value) {
    this.attributes.set('src', String(value));
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((item) => item !== listener));
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ target: this, ...event });
    }
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren() {
    this.children = [];
    this.textContent = '';
  }

  contains(target) {
    return target === this;
  }

  focus() {}

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  load() {
    this.loadCalls += 1;
  }
}

function createViewerDocument() {
  const elements = new Map(VIEWER_SELECTORS.map((selector) => [selector, new SyntheticElement()]));
  const playableVoice = new SyntheticElement();
  playableVoice.paused = false;
  playableVoice.classList.add('playing');
  const listeners = new Map();
  const body = { style: new SyntheticStyle() };

  return {
    body,
    elements,
    playableVoice,
    querySelector(selector) {
      return elements.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      return /playing|audio/iu.test(selector) ? [playableVoice] : [];
    },
    createElement() {
      return new SyntheticElement();
    },
    addEventListener(type, listener) {
      const registered = listeners.get(type) ?? [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    removeEventListener(type, listener) {
      const registered = listeners.get(type) ?? [];
      listeners.set(type, registered.filter((item) => item !== listener));
    },
  };
}

function createLifecycleTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const registered = listeners.get(type) ?? [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    removeEventListener(type, listener) {
      const registered = listeners.get(type) ?? [];
      listeners.set(type, registered.filter((item) => item !== listener));
    },
  };
}

function createFailingViewerSession() {
  return {
    reader: {},
    sessionKey: Object.freeze({ type: 'synthetic-secret' }),
    header: Object.freeze({}),
    manifest: Object.freeze({ contactsResource: undefined }),
    planner: {
      resource() {
        throw new Error('SYNTHETIC_INIT_STOP');
      },
    },
    decryptedResources: new Map(),
    temporaryUrls: new Set(),
  };
}

function createAuthenticatedCandidate() {
  return {
    sessionKey: Object.freeze({ type: 'synthetic-secret' }),
    manifest: Object.freeze({ resources: [] }),
    decryptedResources: new Map(),
    temporaryUrls: new Set(),
  };
}

function createDirtyPresentation(mask = 0x7f) {
  const names = [
    'searchPanel',
    'datePanel',
    'imageOverlay',
    'videoOverlay',
    'menuDropdown',
    'searchBar',
    'loadMore',
  ];
  const elements = Object.fromEntries(names.map((name, index) => {
    const element = new SyntheticElement();
    element.hidden = (mask & (1 << index)) === 0;
    return [name, element];
  }));
  elements.imagePreview = new SyntheticElement();
  elements.imagePreview.src = 'blob:synthetic-image';
  elements.videoPreview = new SyntheticElement();
  elements.videoPreview.src = 'blob:synthetic-video';
  elements.videoPreview.paused = false;

  const voice = new SyntheticElement();
  voice.paused = false;
  voice.classList.add('playing');
  const body = { style: new SyntheticStyle() };
  body.style.overflow = 'hidden';
  const viewerState = {
    searchQuery: 'synthetic query',
    searchResults: [{ msgId: '1:0' }],
    searchIndexCache: { synthetic: true },
    dateJumped: { date: '2000-01-01' },
    isLoading: true,
  };

  return { body, elements, playableVoices: [voice], viewerState, voice };
}

function collectCleanupCounterexamples(presentation, label, counterexamples) {
  for (const name of [
    'searchPanel',
    'datePanel',
    'imageOverlay',
    'videoOverlay',
    'menuDropdown',
    'searchBar',
    'loadMore',
  ]) {
    if (!presentation.elements[name].hidden) counterexamples.push(`${label}: ${name} remains visible`);
  }
  if (!presentation.elements.videoPreview.paused) counterexamples.push(`${label}: video remains active`);
  if (presentation.elements.imagePreview.hasAttribute('src')) counterexamples.push(`${label}: image src remains`);
  if (presentation.elements.videoPreview.hasAttribute('src')) counterexamples.push(`${label}: video src remains`);
  if (presentation.body.style.overflow !== '') counterexamples.push(`${label}: body inline overflow remains`);
  if (!presentation.voice.paused || presentation.voice.classList.contains('playing')) {
    counterexamples.push(`${label}: playable voice state remains`);
  }
  if (presentation.viewerState.searchQuery !== '') counterexamples.push(`${label}: search query remains`);
  if (presentation.viewerState.searchResults.length !== 0) counterexamples.push(`${label}: search results remain`);
  if (presentation.viewerState.searchIndexCache !== null) counterexamples.push(`${label}: search cache remains`);
  if (presentation.viewerState.dateJumped !== null) counterexamples.push(`${label}: date presentation remains`);
  if (presentation.viewerState.isLoading !== false) counterexamples.push(`${label}: loading marker remains`);
}

// **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
test('Property 1: managed runtime visibility has no display-string authority', async () => {
  const [viewerSource, appSource] = await Promise.all([
    readFile(viewerUrl, 'utf8'),
    readFile(appUrl, 'utf8'),
  ]);
  const managedNames = new Set(
    [...viewerSource.matchAll(/\bdom\.(searchPanel|datePanel|imageOverlay|videoOverlay|menuDropdown|searchBar|loadMore)\.style\.display/gu)]
      .map((match) => match[1]),
  );
  const shellNames = new Set(
    [...appSource.matchAll(/\b(lockedView|appView)\.style\.display/gu)].map((match) => match[1]),
  );
  const counterexamples = [
    ...[...managedNames].sort().map((name) => `viewer.js uses ${name}.style.display`),
    ...[...shellNames].sort().map((name) => `app.js uses ${name}.style.display`),
  ];
  if (/initViewer\([^;]+\.catch\(\(\)\s*=>\s*\{\s*\}\)/su.test(appSource)) {
    counterexamples.push('app.js swallows viewer initialization rejection');
  }

  assert.deepEqual(counterexamples, [], `runtime authority counterexamples:\n${counterexamples.join('\n')}`);
});

// **Validates: Requirements 2.2, 2.3, 2.4**
test('Property 1: presentation cleanup is directly testable, exhaustive, and idempotent', () => {
  const counterexamples = [];

  if (typeof viewer.cleanupViewerPresentation !== 'function') {
    counterexamples.push('viewer.js has no directly testable presentation cleanup routine');
  } else {
    for (let mask = 0; mask < 128; mask += 1) {
      const presentation = createDirtyPresentation(mask);
      viewer.cleanupViewerPresentation(presentation);
      collectCleanupCounterexamples(presentation, `dirty mask ${mask}`, counterexamples);

      const videoPauseCalls = presentation.elements.videoPreview.pauseCalls;
      const voicePauseCalls = presentation.voice.pauseCalls;
      viewer.cleanupViewerPresentation(presentation);
      collectCleanupCounterexamples(presentation, `dirty mask ${mask} repeated`, counterexamples);
      if (presentation.elements.videoPreview.pauseCalls !== videoPauseCalls) {
        counterexamples.push(`dirty mask ${mask}: repeated cleanup pauses video again`);
      }
      if (presentation.voice.pauseCalls !== voicePauseCalls) {
        counterexamples.push(`dirty mask ${mask}: repeated cleanup pauses voice again`);
      }
    }

    assert.doesNotThrow(() => viewer.cleanupViewerPresentation({
      body: null,
      elements: { imageOverlay: new SyntheticElement() },
      playableVoices: [],
      viewerState: {},
    }));
  }

  assert.deepEqual(counterexamples, [], `cleanup counterexamples:\n${counterexamples.join('\n')}`);
});

// **Validates: Requirements 2.2, 2.3, 2.4**
test('Property 1: destroyViewer removes dirty presentation after partial initialization', async () => {
  const doc = createViewerDocument();
  const hadDocument = Object.hasOwn(globalThis, 'document');
  const previousDocument = globalThis.document;
  globalThis.document = doc;

  try {
    await assert.rejects(viewer.initViewer(createFailingViewerSession()), /SYNTHETIC_INIT_STOP/u);

    for (const selector of TRANSIENT_SELECTORS) doc.elements.get(selector).hidden = false;
    doc.elements.get('#image-preview').src = 'blob:synthetic-image';
    doc.elements.get('#video-preview').src = 'blob:synthetic-video';
    doc.elements.get('#video-preview').paused = false;
    doc.body.style.overflow = 'hidden';
    doc.playableVoice.paused = false;
    doc.playableVoice.classList.add('playing');

    viewer.destroyViewer();

    const counterexamples = [];
    for (const selector of TRANSIENT_SELECTORS) {
      if (!doc.elements.get(selector).hidden) counterexamples.push(`destroyViewer leaves ${selector} visible`);
    }
    if (!doc.elements.get('#video-preview').paused) counterexamples.push('destroyViewer does not pause active video');
    if (doc.elements.get('#image-preview').hasAttribute('src')) counterexamples.push('destroyViewer retains image src');
    if (doc.elements.get('#video-preview').hasAttribute('src')) counterexamples.push('destroyViewer retains video src');
    if (doc.body.style.overflow !== '') counterexamples.push('destroyViewer retains body inline overflow');
    if (!doc.playableVoice.paused || doc.playableVoice.classList.contains('playing')) {
      counterexamples.push('destroyViewer retains playable voice state');
    }
    assert.doesNotThrow(() => viewer.destroyViewer());
    assert.deepEqual(counterexamples, [], `destroy counterexamples:\n${counterexamples.join('\n')}`);
  } finally {
    viewer.destroyViewer();
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  }
});

// **Validates: Requirements 2.2, 2.3**
test('Property 1: viewer initialization rejection returns the app to generic locked state', async () => {
  const doc = createViewerDocument();
  const lifecycleTarget = createLifecycleTarget();
  const hadDocument = Object.hasOwn(globalThis, 'document');
  const hadWindow = Object.hasOwn(globalThis, 'window');
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = doc;
  globalThis.window = lifecycleTarget;
  let destroyCalls = 0;

  try {
    const app = createApp(doc, {
      createSession: async () => createAuthenticatedCandidate(),
      initViewer: async () => { throw new Error('SYNTHETIC_VIEWER_PRIVATE_DETAIL'); },
      destroyViewer: () => { destroyCalls += 1; },
      lifecycleTarget,
    });

    const importAccepted = await app.controller.beginImport({ name: 'synthetic.wcv', size: 64 }, 'password');
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(importAccepted, true);
    assert.equal(app.controller.state, SESSION_STATE.LOCKED);
    assert.equal(doc.elements.get('#status').textContent, UI_MESSAGES.FAILURE);
    assert.doesNotMatch(doc.elements.get('#status').textContent, /SYNTHETIC_VIEWER_PRIVATE_DETAIL/u);
    assert.equal(doc.elements.get('#locked-view').hidden, false);
    assert.equal(doc.elements.get('#app-view').hidden, true);
    assert.ok(destroyCalls >= 1);
  } finally {
    viewer.destroyViewer();
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
    if (hadWindow) globalThis.window = previousWindow;
    else delete globalThis.window;
  }
});
