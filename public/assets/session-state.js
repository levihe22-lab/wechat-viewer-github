export const SESSION_STATE = Object.freeze({
  LOCKED: 'locked',
  IMPORTING: 'importing',
  UNLOCKED: 'unlocked',
  CLEARING: 'clearing',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [SESSION_STATE.LOCKED]: Object.freeze([SESSION_STATE.IMPORTING]),
  [SESSION_STATE.IMPORTING]: Object.freeze([
    SESSION_STATE.UNLOCKED,
    SESSION_STATE.CLEARING,
  ]),
  [SESSION_STATE.UNLOCKED]: Object.freeze([SESSION_STATE.CLEARING]),
  [SESSION_STATE.CLEARING]: Object.freeze([SESSION_STATE.LOCKED]),
});

export function canTransition(from, to) {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isSessionState(value) {
  return Object.values(SESSION_STATE).includes(value);
}
