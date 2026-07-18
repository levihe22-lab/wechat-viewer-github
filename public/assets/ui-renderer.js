import { SESSION_STATE } from './session-state.js';

export const UI_MESSAGES = Object.freeze({
  READY: '请选择本地 .wcv 文件并输入密码。',
  FILE_REQUIRED: '请选择有效的本地 .wcv 文件。',
  PASSWORD_REQUIRED: '请输入包密码。',
  IMPORTING: '正在当前页面内存中验证本地加密包…',
  CLEARING: '正在锁定并清除当前页面会话…',
  FAILURE: '无法验证此本地包。请重新选择文件并输入密码。',
  UNLOCKED: '解锁成功。仅可显示通过认证的本地包内容。',
});

export class UiRenderer {
  constructor(doc = document) {
    this.doc = doc;
    this.lockedView = requireElement(doc, '#locked-view');
    this.unlockedView = requireElement(doc, '#unlocked-view');
    this.status = requireElement(doc, '#status');
    this.fileInput = requireElement(doc, '#package-file');
    this.passwordInput = requireElement(doc, '#package-password');
    this.unlockButton = requireElement(doc, '#unlock-button');
    this.cancelButton = requireElement(doc, '#cancel-button');
    this.authenticatedContent = requireElement(doc, '#authenticated-content');
  }

  render(state, message) {
    switch (state) {
      case SESSION_STATE.LOCKED:
        this.renderLocked(message);
        break;
      case SESSION_STATE.IMPORTING:
        this.renderImporting();
        break;
      case SESSION_STATE.UNLOCKED:
        this.renderUnlocked();
        break;
      case SESSION_STATE.CLEARING:
        this.renderClearing();
        break;
      default:
        throw new Error('UI_STATE_INVALID');
    }
  }

  renderLocked(message = UI_MESSAGES.READY) {
    this.clearAuthenticatedContent();
    this.lockedView.hidden = false;
    this.unlockedView.hidden = true;
    this.status.textContent = safeMessage(message, UI_MESSAGES.READY);
    this.setImportControls(false);
  }

  renderImporting() {
    this.clearAuthenticatedContent();
    this.lockedView.hidden = false;
    this.unlockedView.hidden = true;
    this.status.textContent = UI_MESSAGES.IMPORTING;
    this.setImportControls(true);
  }

  renderUnlocked() {
    this.lockedView.hidden = true;
    this.unlockedView.hidden = false;
    this.status.textContent = '';
    this.authenticatedContent.textContent = UI_MESSAGES.UNLOCKED;
    this.setImportControls(false);
  }

  renderClearing() {
    this.clearAuthenticatedContent();
    this.lockedView.hidden = false;
    this.unlockedView.hidden = true;
    this.status.textContent = UI_MESSAGES.CLEARING;
    this.setImportControls(true);
  }

  renderFailure() {
    this.renderLocked(UI_MESSAGES.FAILURE);
  }

  clearInputs() {
    this.fileInput.value = '';
    this.passwordInput.value = '';
  }

  clearAuthenticatedContent() {
    this.authenticatedContent.replaceChildren();
    this.authenticatedContent.textContent = '';
  }

  setImportControls(busy) {
    this.fileInput.disabled = busy;
    this.passwordInput.disabled = busy;
    this.unlockButton.disabled = busy;
    this.cancelButton.hidden = !busy;
    this.cancelButton.disabled = false;
  }
}

function requireElement(doc, selector) {
  const element = doc.querySelector(selector);
  if (!element) throw new Error('UI_ELEMENT_MISSING');
  return element;
}

function safeMessage(message, fallback) {
  return Object.values(UI_MESSAGES).includes(message) ? message : fallback;
}
