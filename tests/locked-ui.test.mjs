import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { SESSION_STATE } from '../public/assets/session-state.js';
import { UI_MESSAGES, UiRenderer } from '../public/assets/ui-renderer.js';

const htmlUrl = new URL('../public/index.html', import.meta.url);

class SyntheticElement {
  constructor() {
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
  }

  replaceChildren() {
    this.textContent = '';
  }
}

function createSyntheticDocument() {
  const selectors = [
    '#status',
    '#package-file',
    '#package-password',
    '#unlock-button',
    '#cancel-button',
  ];
  const elements = new Map(selectors.map((selector) => [selector, new SyntheticElement()]));
  return {
    elements,
    querySelector(selector) {
      return elements.get(selector) ?? null;
    },
  };
}

test('locked shell contains required generic controls and relative assets', async () => {
  const html = await readFile(htmlUrl, 'utf8');

  assert.match(html, /id="package-file"[^>]+type="file"[^>]+accept="\.wcv"/u);
  assert.match(html, /id="package-password"[^>]+type="password"/u);
  assert.match(html, /id="unlock-button"[^>]+type="button"/u);
  assert.match(html, /href="\.\/assets\/app\.css"/u);
  assert.match(html, /src="\.\/assets\/app\.js"/u);
  assert.doesNotMatch(html, /(?:href|src)="\/[^/]/u);
});

test('privacy boundary and external navigation require visible user action', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const externalLink = html.match(/<a\s+href="[^"]+"[^>]*>([^<]+)<\/a>/u);

  assert.ok(externalLink);
  assert.ok(externalLink[0].includes('href="https://docs.github.com/pages"'));
  assert.match(externalLink[0], /target="_blank"/u);
  assert.match(externalLink[0], /rel="noopener noreferrer external"/u);
  assert.ok(externalLink[1].trim().length > 0);
  assert.match(html, /公开/u);
  assert.match(html, /访问 IP/u);
  assert.match(html, /不承诺绝对隐私/u);
  assert.match(html, /当前页面内存/u);
  assert.match(html, /不.*离线/u);
  assert.doesNotMatch(html, /<(?:link|script)[^>]+https?:/iu);
  assert.doesNotMatch(html, /rel="(?:preconnect|prefetch|dns-prefetch|prerender)"/iu);
});

test('renderer keeps importing, clearing and failure views generic', () => {
  const doc = createSyntheticDocument();
  const renderer = new UiRenderer(doc);
  const sentinel = 'SYNTHETIC_PRIVATE_SENTINEL';

  renderer.render(SESSION_STATE.IMPORTING, sentinel);
  assert.equal(doc.elements.get('#status').textContent, UI_MESSAGES.IMPORTING);
  assert.equal(doc.elements.get('#unlock-button').disabled, true);

  renderer.render(SESSION_STATE.CLEARING, sentinel);
  assert.equal(doc.elements.get('#status').textContent, UI_MESSAGES.CLEARING);

  // Failure message is rendered via LOCKED state with FAILURE text
  renderer.render(SESSION_STATE.LOCKED, UI_MESSAGES.FAILURE);
  assert.equal(doc.elements.get('#status').textContent, UI_MESSAGES.FAILURE);
  assert.doesNotMatch(doc.elements.get('#status').textContent, new RegExp(sentinel, 'u'));
});

const MANAGED_SURFACES = Object.freeze([
  '#app-view',
  '#search-panel',
  '#date-panel',
  '#image-overlay',
  '#video-overlay',
]);
const TRANSIENT_SURFACES = Object.freeze(MANAGED_SURFACES.slice(1));

function openingTag(html, selector) {
  const id = selector.slice(1);
  return html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`, 'iu'))?.[0] ?? '';
}

function createPropertySurfaceDocument() {
  const selectors = [
    '#status',
    '#package-file',
    '#package-password',
    '#unlock-button',
    '#cancel-button',
    '#locked-view',
    ...MANAGED_SURFACES,
  ];
  const elements = new Map(selectors.map((selector) => [selector, new SyntheticElement()]));
  return {
    elements,
    querySelector(selector) {
      return elements.get(selector) ?? null;
    },
  };
}

// **Validates: Requirements 2.1, 2.2, 2.4**
test('Property 1: first paint has one effective hidden visibility contract', async () => {
  const [html, css] = await Promise.all([
    readFile(htmlUrl, 'utf8'),
    readFile(new URL('../public/assets/app.css', import.meta.url), 'utf8'),
  ]);
  const counterexamples = [];

  for (const selector of MANAGED_SURFACES) {
    const tag = openingTag(html, selector);
    if (!/\shidden(?:\s|=|>)/iu.test(tag)) {
      counterexamples.push(`${selector} lacks the hidden attribute`);
    }
    if (/\bstyle\s*=\s*["'][^"']*\bdisplay\s*:/iu.test(tag)) {
      counterexamples.push(`${selector} uses an inline display declaration`);
    }
  }

  for (const selector of ['#menu-dropdown', '#search-bar', '#load-more']) {
    const tag = openingTag(html, selector);
    if (!/\shidden(?:\s|=|>)/iu.test(tag)) {
      counterexamples.push(`${selector} lacks the hidden attribute`);
    }
    if (/\bstyle\s*=\s*["'][^"']*\bdisplay\s*:/iu.test(tag)) {
      counterexamples.push(`${selector} uses an inline display declaration`);
    }
  }

  const hiddenRule = css.match(/\[hidden\]\s*\{(?<body>[^}]*)\}/iu)?.groups?.body ?? '';
  if (!/\bdisplay\s*:\s*none\s*!important\s*;/iu.test(hiddenRule)) {
    counterexamples.push('app.css lacks [hidden] { display: none !important; }');
  }

  assert.deepEqual(counterexamples, [], `first-paint counterexamples:\n${counterexamples.join('\n')}`);
});

// **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
test('Property 1: renderer authorizes only state-owned surfaces', () => {
  const doc = createPropertySurfaceDocument();
  const renderer = new UiRenderer(doc);
  const stateCases = [
    { label: 'bootstrap/locked', state: SESSION_STATE.LOCKED, lockedHidden: false, appHidden: true },
    { label: 'importing', state: SESSION_STATE.IMPORTING, lockedHidden: false, appHidden: true },
    { label: 'clearing', state: SESSION_STATE.CLEARING, lockedHidden: false, appHidden: true },
    { label: 'unlocked-without-media-selection', state: SESSION_STATE.UNLOCKED, lockedHidden: true, appHidden: false },
  ];
  const counterexamples = [];

  for (const stateCase of stateCases) {
    doc.elements.get('#locked-view').hidden = !stateCase.lockedHidden;
    doc.elements.get('#app-view').hidden = !stateCase.appHidden;
    for (const selector of TRANSIENT_SURFACES) doc.elements.get(selector).hidden = false;

    renderer.render(stateCase.state);

    for (const [selector, expected] of [
      ['#locked-view', stateCase.lockedHidden],
      ['#app-view', stateCase.appHidden],
      ...TRANSIENT_SURFACES.map((selector) => [selector, true]),
    ]) {
      const actual = doc.elements.get(selector).hidden;
      if (actual !== expected) {
        counterexamples.push(`${stateCase.label} leaves ${selector} hidden=${actual}; expected ${expected}`);
      }
    }
  }

  assert.deepEqual(counterexamples, [], `renderer counterexamples:\n${counterexamples.join('\n')}`);
});
