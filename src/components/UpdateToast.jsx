import { useState } from 'react';
import { setActivating } from '../pwa/swUpdateStore.js';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate.js';

const DISMISSED_KEY = 'fleetdesk.update-dismissed';

/**
 * Offers the new version instead of installing it silently.
 *
 * The waiting worker only takes over when the user presses the button: a
 * background swap would leave this very page asking the new cache for chunks that
 * no longer exist.
 */
export default function UpdateToast() {
  const { updateReady, activating, activate } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!updateReady || dismissed) return null;

  function handleLater() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage is unavailable: hiding it for this render is enough.
    }
    setDismissed(true);
  }

  function handleUpdate() {
    setActivating();
    activate?.();
    // The page reloads itself once the new worker takes control
    // (controllerchange in src/pwa/registerSW.js).
  }

  return (
    <div className="update-toast" role="status">
      <p className="update-toast__text">
        <strong>A new version of FleetDesk is ready.</strong>
        {' '}
        It will load after you update.
      </p>
      <div className="update-toast__actions">
        <button
          type="button"
          className="button button--primary button--sm"
          onClick={handleUpdate}
          disabled={activating}
        >
          {activating ? 'Updating…' : 'Update now'}
        </button>
        <button type="button" className="button button--ghost button--sm" onClick={handleLater}>
          Later
        </button>
      </div>
    </div>
  );
}
