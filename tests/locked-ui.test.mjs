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
    '#locked-view',
    '#unlocked-view',
    '#status',
    '#package-file',
    '#package-password',
    '#unlock-button',
    '#cancel-button',
    '#authenticated-content',
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
  assert.equal(doc.elements.get('#locked-view').hidden, false);
  assert.equal(doc.elements.get('#unlocked-view').hidden, true);
  assert.equal(doc.elements.get('#status').textContent, UI_MESSAGES.IMPORTING);
  assert.equal(doc.elements.get('#unlock-button').disabled, true);

  doc.elements.get('#authenticated-content').textContent = sentinel;
  renderer.render(SESSION_STATE.CLEARING, sentinel);
  assert.equal(doc.elements.get('#authenticated-content').textContent, '');
  assert.equal(doc.elements.get('#status').textContent, UI_MESSAGES.CLEARING);

  renderer.renderFailure(new Error(sentinel));
  const visibleText = [
    doc.elements.get('#status').textContent,
    doc.elements.get('#authenticated-content').textContent,
  ].join(' ');
  assert.equal(doc.elements.get('#locked-view').hidden, false);
  assert.equal(doc.elements.get('#unlocked-view').hidden, true);
  assert.equal(doc.elements.get('#status').textContent, UI_MESSAGES.FAILURE);
  assert.doesNotMatch(visibleText, new RegExp(sentinel, 'u'));
});
