import { Link } from 'react-router-dom';
import { useConnectivity } from '../hooks/useConnectivity.js';

/**
 * The online/offline indicator in the header.
 *
 * Online it stays out of the way (a dot, no text on narrow screens); offline it
 * becomes a link to the offline page, which explains what still works.
 */
export default function ConnectionStatus() {
  const { status, isOffline, isChecking } = useConnectivity();

  const label = isOffline ? 'Offline' : isChecking ? 'Checking…' : 'Online';

  const content = (
    <>
      <span className="connection-status__dot" aria-hidden="true" />
      <span className="connection-status__label">{label}</span>
    </>
  );

  if (isOffline) {
    return (
      <Link
        to="/offline"
        className="connection-status connection-status--offline"
        aria-live="polite"
        title="No connection — see what still works"
      >
        {content}
      </Link>
    );
  }

  return (
    <p className={`connection-status connection-status--${status}`} aria-live="polite">
      {content}
    </p>
  );
}
