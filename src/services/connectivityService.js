import { pingUrl } from '../api/endpoints.js';

// Real offline detection.
//
// `navigator.onLine === true` only means "a network interface is up": a captive
// portal, a dead uplink or a dropped VPN all keep reporting `true`. Only the
// negative is trustworthy. So the service combines three signals:
//
//   1. `navigator.onLine === false`  -> offline immediately, no probe needed;
//   2. a probe of a one-byte file    -> proves the origin is actually reachable;
//   3. the app's own traffic         -> src/api/http.js reports every success and
//                                       every network failure, which is the
//                                       cheapest and most accurate signal there is.

const PROBE_TIMEOUT_MS = 3000;
const RETRY_START_MS = 5000;
const RETRY_MAX_MS = 60_000;

const listeners = new Set();

let status = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online';
let lastCheckedAt = null;
let snapshot = createSnapshot();
let probe = null;
let retryTimer = null;
let retryDelay = RETRY_START_MS;

function createSnapshot() {
  return Object.freeze({
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isChecking: status === 'checking',
    lastCheckedAt,
  });
}

function emit() {
  snapshot = createSnapshot();
  for (const listener of listeners) listener();
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  if (next === 'online') stopRetrying();
  else if (next === 'offline') scheduleRetry();
  emit();
}

function stopRetrying() {
  clearTimeout(retryTimer);
  retryTimer = null;
  retryDelay = RETRY_START_MS;
}

// Poll only while offline, with a backoff: an installed app left on a phone must
// not wake the radio every few seconds, and while online the passive signals
// above already keep the state fresh.
function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    checkConnectivity();
  }, retryDelay);
}

function timeoutSignal(ms) {
  // AbortSignal.timeout needs Safari 16+; fall back for everything older.
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(ms), done: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/**
 * Asks the network directly. Resolves to `true` when the origin answered.
 * Concurrent calls share one in-flight probe.
 */
export function checkConnectivity() {
  if (probe) return probe;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    lastCheckedAt = Date.now();
    setStatus('offline');
    emit();
    return Promise.resolve(false);
  }

  setStatus('checking');

  const { signal, done } = timeoutSignal(PROBE_TIMEOUT_MS);
  probe = fetch(`${pingUrl()}?t=${Date.now()}`, { cache: 'no-store', signal })
    .then((response) => response.ok)
    .catch(() => false)
    .then((reachable) => {
      done();
      probe = null;
      lastCheckedAt = Date.now();
      setStatus(reachable ? 'online' : 'offline');
      emit();
      return reachable;
    });

  return probe;
}

/** Called by the fetch layer whenever a response really came off the network. */
export function reportNetworkSuccess() {
  lastCheckedAt = Date.now();
  setStatus('online');
}

/** Called by the fetch layer when a request failed with a network error. */
export function reportNetworkFailure() {
  lastCheckedAt = Date.now();
  setStatus('offline');
}

export function subscribeConnectivity(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConnectivity() {
  return snapshot;
}

/**
 * Wires the browser events. Returns a cleanup function.
 * `online` is verified with a probe because the event is as optimistic as the flag.
 */
export function startConnectivityMonitor() {
  const handleOnline = () => { checkConnectivity(); };
  const handleOffline = () => { setStatus('offline'); };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    stopRetrying();
  };
}
