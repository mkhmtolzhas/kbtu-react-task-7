import { Link, useNavigate } from 'react-router-dom';
import { useConnectivity } from '../hooks/useConnectivity.js';
import { formatCachedAt } from '../utils/format.js';

/**
 * The in-app offline screen.
 *
 * It is reached from the header indicator and from error states. The service
 * worker cannot send a browser to a hash route, so it has its own plain
 * `public/offline.html` for the case where even the application shell is missing;
 * this page is the one users actually see.
 */
export default function OfflinePage() {
  const { isOffline, isChecking, lastCheckedAt, retry } = useConnectivity();
  const navigate = useNavigate();

  async function handleRetry() {
    const reachable = await retry();
    if (reachable) navigate(-1);
  }

  return (
    <div className="page page--narrow offline-page">
      <div className="offline-page__card">
        <span className="offline-page__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 2 22 22" />
            <path d="M5 12.5a10 10 0 0 1 4-2.4" />
            <path d="M8.5 16a5.5 5.5 0 0 1 2.2-1.3" />
            <path d="M15.5 10.4a10 10 0 0 1 3.5 2.1" />
            <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>

        <h1 className="offline-page__title">
          {isOffline ? 'You are offline' : isChecking ? 'Checking the connection…' : 'Connection restored'}
        </h1>

        <p className="offline-page__text">
          {isOffline
            ? 'FleetDesk cannot reach the fleet catalogue right now. Everything you have already opened is still here, saved on this device.'
            : isChecking
              ? 'Asking the server whether it can be reached.'
              : 'The network is reachable again. Go back to what you were doing.'}
        </p>

        <ul className="offline-page__list">
          <li>Vehicles you have already browsed stay readable.</li>
          <li>Status changes, new vehicles and removals are saved on this device.</li>
          <li>Signing in and out needs a connection.</li>
        </ul>

        <div className="offline-page__actions">
          <button type="button" className="button button--primary" onClick={handleRetry} disabled={isChecking}>
            {isChecking ? 'Checking…' : 'Retry connection'}
          </button>
          <Link className="button button--ghost" to="/vehicles">Browse saved fleet</Link>
        </div>

        {lastCheckedAt && (
          <p className="offline-page__checked">
            Last checked {formatCachedAt(new Date(lastCheckedAt).toISOString())}.
          </p>
        )}
      </div>
    </div>
  );
}
