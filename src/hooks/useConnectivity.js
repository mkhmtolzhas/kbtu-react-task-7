import { useContext } from 'react';
import { ConnectivityContext } from '../context/ConnectivityContext.js';

/** The only way components learn whether the app can reach the network. */
export function useConnectivity() {
  const value = useContext(ConnectivityContext);
  if (value === null) {
    throw new Error('useConnectivity() must be used inside <ConnectivityProvider>.');
  }
  return value;
}
