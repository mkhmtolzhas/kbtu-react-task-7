import { createContext } from 'react';

/**
 * Shape of the value provided by <ConnectivityProvider>:
 * {
 *   status: 'online' | 'offline' | 'checking',
 *   isOnline, isOffline, isChecking: boolean,
 *   lastCheckedAt: number | null,
 *   retry: () => Promise<boolean>
 * }
 * Read it through the useConnectivity() hook, never with useContext directly.
 */
export const ConnectivityContext = createContext(null);
