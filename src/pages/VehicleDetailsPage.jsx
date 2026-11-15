import { Link, useParams } from 'react-router-dom';
import VehicleDetails from '../components/VehicleDetails.jsx';
import { useSessionState } from '../hooks/useSessionState.js';

export default function VehicleDetailsPage() {
  const { id } = useParams();
  // Lives above the keyed subtree, and in sessionStorage: the estimate survives
  // jumping from one vehicle to another and going back through the list, which is
  // the whole point of being able to compare prices.
  const [tripMinutes, setTripMinutes] = useSessionState('fleetdesk.trip-minutes', '60');

  return (
    <div className="page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/vehicles">
          <span aria-hidden="true">← </span>Fleet overview
        </Link>
      </nav>
      {/* key={id}: another id => React unmounts the old details and mounts fresh ones. */}
      <VehicleDetails
        key={id}
        id={id}
        tripMinutes={tripMinutes}
        onTripMinutesChange={setTripMinutes}
      />
    </div>
  );
}
