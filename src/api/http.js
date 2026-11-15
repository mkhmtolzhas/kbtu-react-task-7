import { SERVED_FROM_CACHE, SW_CONTRACT } from '../pwa/swContract.js';
import { recordCacheMeta } from '../services/cacheStatusStore.js';
import { reportNetworkFailure, reportNetworkSuccess } from '../services/connectivityService.js';
import { ApiError, isAbortError } from './network.js';

// The single place in the app that calls `fetch`.
//
// Everything the rest of the code needs to know about the network passes through
// here: failures become ApiError, the service worker's cache headers become cache
// metadata for the UI, and both outcomes feed the connectivity service.

export async function fetchJson(url, { signal } = {}) {
  let response;

  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    // An aborted request is a cancelled one, not a failed one: the caller
    // (React Query) switched to a newer request and expects an AbortError.
    if (isAbortError(error)) throw error;
    reportNetworkFailure();
    throw new ApiError('No connection to the fleet catalogue.', { status: 0, offline: true });
  }

  const servedFrom = response.headers.get(SW_CONTRACT.servedFromHeader);
  const cachedAt = response.headers.get(SW_CONTRACT.cachedAtHeader);

  if (!response.ok) {
    // 503 + "none" is the worker saying: offline and nothing cached for this URL.
    if (response.status === 503 && servedFrom === 'none') {
      reportNetworkFailure();
      throw new ApiError('This data has not been saved for offline use yet.', {
        status: 0,
        offline: true,
      });
    }
    if (response.status === 404) {
      throw new ApiError('Not found.', { status: 404 });
    }
    throw new ApiError(`The fleet server answered with ${response.status}.`, {
      status: response.status,
    });
  }

  const fromCache = servedFrom === SERVED_FROM_CACHE;
  // Only a genuine network answer proves the connection works.
  if (!fromCache) reportNetworkSuccess();
  recordCacheMeta(url, { servedFrom, cachedAt });

  return {
    data: await response.json(),
    meta: { fromCache, cachedAt: cachedAt ?? null },
  };
}
