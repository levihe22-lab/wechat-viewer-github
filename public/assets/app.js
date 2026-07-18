import { SessionController } from './session-controller.js';
import { UiRenderer } from './ui-renderer.js';
import { createWcv3Session } from './wcv3-session-factory.js';
import { bindLifecycle } from './lifecycle-events.js';

export function createApp(doc = document, options = {}) {
  const renderer = new UiRenderer(doc);
  const controller = new SessionController(renderer, {
    createSession: createWcv3Session,
    ...options,
  });
  const fileInput = doc.querySelector('#package-file');
  const passwordInput = doc.querySelector('#package-password');

  doc.querySelector('#unlock-button').addEventListener('click', async () => {
    try {
      await controller.beginImport(fileInput.files?.[0], passwordInput.value);
    } finally {
      passwordInput.value = '';
    }
  });

  doc.querySelector('#cancel-button').addEventListener('click', () => {
    controller.cancelImport();
  });

  doc.querySelector('#lock-button').addEventListener('click', () => {
    controller.lock();
  });

  bindLifecycle(controller);

  return Object.freeze({ controller, renderer });
}

if (typeof document !== 'undefined') {
  createApp(document);
}
