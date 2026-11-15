import VehicleCard from './VehicleCard.jsx';

/**
 * `resetToken` is part of every card's key. Changing it gives each card a new
 * identity, so React unmounts the old ones and the per-card shift checks start
 * from scratch — while the id alone keeps that state attached to the right car
 * when the list is searched, filtered or re-sorted.
 */
export default function VehicleGrid({ vehicles, busy = false, resetToken = 0 }) {
  return (
    <ul className={`vehicle-grid${busy ? ' vehicle-grid--busy' : ''}`} aria-busy={busy}>
      {vehicles.map((vehicle) => (
        <li key={`${vehicle.id}:${resetToken}`}>
          <VehicleCard vehicle={vehicle} />
        </li>
      ))}
    </ul>
  );
}
