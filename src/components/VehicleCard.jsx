import { useState } from 'react';
import { Link } from 'react-router-dom';
import FuelGauge from './FuelGauge.jsx';
import LicensePlate from './LicensePlate.jsx';
import StatusBadge from './StatusBadge.jsx';
import { CLASS_LABELS } from '../utils/constants.js';
import { formatKm, formatTenge } from '../utils/format.js';
import { energyLabel, isLowFuel, isServiceOverdue } from '../utils/vehicle.js';

/**
 * A card owns the shift checks of its own vehicle.
 *
 * This state is deliberately local and not sent anywhere: it is what a dispatcher
 * ticks off while walking the lot. Because the list keys cards by vehicle id, the
 * ticks follow their car through searching, filtering and re-sorting; "Reset
 * checks" on the page changes the key and clears them all at once.
 */
export default function VehicleCard({ vehicle }) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');

  const lowFuel = isLowFuel(vehicle.fuelLevel);
  const serviceOverdue = isServiceOverdue(vehicle.lastServiceDate);

  return (
    <article className={`vehicle-card${checked ? ' vehicle-card--checked' : ''}`}>
      <div className="vehicle-card__top">
        <LicensePlate plate={vehicle.plate} />
        <StatusBadge status={vehicle.status} />
      </div>

      <h3 className="vehicle-card__title">
        {/* The ::after of this link stretches over the whole card. */}
        <Link className="vehicle-card__link" to={`/vehicles/${vehicle.id}`}>
          {vehicle.brand} {vehicle.model}
        </Link>
      </h3>
      <p className="vehicle-card__meta">
        {vehicle.year} · {CLASS_LABELS[vehicle.class]} · {vehicle.district}
      </p>

      <FuelGauge level={vehicle.fuelLevel} vehicleClass={vehicle.class} />

      <dl className="vehicle-card__stats">
        <div>
          <dt>Price</dt>
          <dd>{formatTenge(vehicle.pricePerMinute)}/min</dd>
        </div>
        <div>
          <dt>Mileage</dt>
          <dd>{formatKm(vehicle.mileageKm)}</dd>
        </div>
      </dl>

      {(lowFuel || serviceOverdue) && (
        <ul className="flags">
          {lowFuel && <li className="flag flag--warning">Low {energyLabel(vehicle.class).toLowerCase()}</li>}
          {serviceOverdue && <li className="flag flag--danger">Service overdue</li>}
        </ul>
      )}

      <div className="vehicle-card__check">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>Checked on this shift</span>
        </label>

        {checked && (
          <input
            type="text"
            className="input input--sm vehicle-card__note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Shift note (stays on this device)"
            aria-label={`Shift note for ${vehicle.plate}`}
          />
        )}
      </div>
    </article>
  );
}
