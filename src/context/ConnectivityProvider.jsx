import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConnectivityContext } from './ConnectivityContext.js';
import {
  checkConnectivity,
  getConnectivity,
  startConnectivityMonitor,
  subscribeConnectivity,
} from '../services/connectivityService.js';

/**
 * Makes one connection state available to the whole app: the header indicator,
 * the offline page and the error messages all read the same source, so they can
 * never disagree.
 */
export default function ConnectivityProvider({ children }) {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(subscribeConnectivity, getConnectivity, getConnectivity);
  const wasOffline = useRef(state.isOffline);

  useEffect(() => startConnectivityMonitor(), []);

  useEffect(() => {
    // The browser's flag is optimistic, so the real state is established once at
    // start-up by asking the network.
    checkConnectivity();
  }, []);

  useEffect(() => {
    // Coming back from offline: everything in the cache may have moved on.
    if (wasOffline.current && state.isOnline) queryClient.invalidateQueries();
    wasOffline.current = state.isOffline;
  }, [state.isOnline, state.isOffline, queryClient]);

  const value = useMemo(
    () => ({ ...state, retry: checkConnectivity }),
    [state],
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}
