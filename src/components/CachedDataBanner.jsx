import { useCacheStatus } from '../hooks/useCacheStatus.js';
import { useConnectivity } from '../hooks/useConnectivity.js';
import { formatCachedAt } from '../utils/format.js';

// A saved copy this old is worth announcing even with a connection; anything
// fresher is just stale-while-revalidate doing its job quietly.
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Tells the user when the data on screen is a saved copy rather than a fresh
 * answer — the difference between "the fleet looks wrong" and "this is what the
 * fleet looked like at 14:32".
 *
 * It reads the most recent API answer, so it covers every screen at once. The
 * list page also marks its own results inline, which is what shows during the
 * ordinary online case where the copy is seconds old.
 */
export default function CachedDataBanner() {
  const { fromCache, cachedAt } = useCacheStatus();
  const { isOffline } = useConnectivity();

  if (!fromCache) return null;

  const age = cachedAt ? Date.now() - Date.parse(cachedAt) : 0;
  const isStale = Number.isFinite(age) && age > STALE_AFTER_MS;
  if (!isOffline && !isStale) return null;

  return (
    <p className="cache-banner" role="status">
      <span className="cache-banner__dot" aria-hidden="true" />
      {isOffline ? 'Offline — showing data saved' : 'Showing data saved'}
      {cachedAt ? ` ${formatCachedAt(cachedAt)}` : ''}
      .
    </p>
  );
}
