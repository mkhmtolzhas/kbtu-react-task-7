// Bridges the service worker registration (plain browser code, running at module
// scope) into React. A tiny external store rather than component state, because
// registration must happen exactly once per page — not once per mount, which is
// what an effect would give under StrictMode.

const NO_UPDATE = Object.freeze({ updateReady: false, activating: false, activate: null });

const listeners = new Set();
let snapshot = NO_UPDATE;

function emit() {
  for (const listener of listeners) listener();
}

export function setUpdateReady(activate) {
  snapshot = Object.freeze({ updateReady: true, activating: false, activate });
  emit();
}

export function setActivating() {
  if (!snapshot.updateReady) return;
  snapshot = Object.freeze({ ...snapshot, activating: true });
  emit();
}

export function clearUpdate() {
  if (snapshot === NO_UPDATE) return;
  snapshot = NO_UPDATE;
  emit();
}

export function subscribeUpdate(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUpdateSnapshot() {
  return snapshot;
}

export function getServerUpdateSnapshot() {
  return NO_UPDATE;
}
