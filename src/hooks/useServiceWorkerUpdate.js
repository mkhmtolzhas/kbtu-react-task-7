import { useSyncExternalStore } from 'react';
import {
  getServerUpdateSnapshot,
  getUpdateSnapshot,
  subscribeUpdate,
} from '../pwa/swUpdateStore.js';

/** `{ updateReady, activating, activate }` — drives <UpdateToast />. */
export function useServiceWorkerUpdate() {
  return useSyncExternalStore(subscribeUpdate, getUpdateSnapshot, getServerUpdateSnapshot);
}
