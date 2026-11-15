import { Link, useSearchParams } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Spinner from '../components/Spinner.jsx';
import StatBreakdown from '../components/StatBreakdown.jsx';
import { useFleetStatsQuery } from '../hooks/useVehicleQueries.js';
import {
  CLASS_LABELS,
  DISTRICTS,
  LOW_FUEL_THRESHOLD,
  SERVICE_INTERVAL_DAYS,
  STATUS_LABELS,
  VEHICLE_CLASSES,
  VEHICLE_STATUSES,
} from '../utils/constants.js';
import { formatTenge } from '../utils/format.js';

// The district filter lives in the URL, so a dashboard narrowed to one district
// can be sent to someone else, survives a reload and works with Back/Forward.
const DISTRICT_PARAM = 'district';

function listLink(params) {
  const search = new URLSearchParams(params);
  return `/vehicles?${search.toString()}`;
}

/** Fleet-wide numbers: five statistics, three breakdowns, one interactive filter. */
export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const district = searchParams.get(DISTRICT_PARAM) ?? 'all';

  const { data: stats, isPending, isError, error, isFetching, refetch } = useFleetStatsQuery({ district });

  function handleDistrictChange(value) {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete(DISTRICT_PARAM);
    else next.set(DISTRICT_PARAM, value);
    setSearchParams(next, { replace: true });
  }

  const scopeSuffix = district === 'all' ? {} : { district };

  const statistics = stats ? [
    {
      key: 'total',
      label: 'Vehicles in scope',
      value: stats.total,
      hint: district === 'all' ? 'The whole fleet' : `of ${stats.fleetTotal} in the fleet`,
      to: listLink(scopeSuffix),
    },
    {
      key: 'available',
      label: 'Ready to rent',
      value: stats.byStatus.available,
      hint: 'Available right now',
      to: listLink({ ...scopeSuffix, status: 'available' }),
    },
    {
      key: 'lowFuel',
      label: 'Low fuel or charge',
      value: stats.lowFuel,
      hint: `Below ${LOW_FUEL_THRESHOLD} %`,
      to: listLink({ ...scopeSuffix, sort: 'fuelLevel', dir: 'asc' }),
      tone: 'warning',
    },
    {
      key: 'overdue',
      label: 'Service overdue',
      value: stats.serviceOverdue,
      hint: `Last service over ${SERVICE_INTERVAL_DAYS} days ago`,
      to: listLink({ ...scopeSuffix, sort: 'lastServiceDate', dir: 'asc' }),
      tone: 'danger',
    },
    {
      key: 'price',
      label: 'Average price',
      value: formatTenge(stats.averagePricePerMinute),
      hint: 'Per minute',
      to: listLink({ ...scopeSuffix, sort: 'pricePerMinute', dir: 'desc' }),
    },
  ] : [];

  return (
    <div className="page dashboard">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Dashboard</h1>
          <p className="page-header__subtitle">
            How the fleet is doing right now. Every number opens the cars behind it.
          </p>
        </div>

        <div className="field dashboard__filter">
          <label className="field__label" htmlFor="dashboard-district">District</label>
          <select
            id="dashboard-district"
            className="input"
            value={district}
            onChange={(event) => handleDistrictChange(event.target.value)}
          >
            <option value="all">All districts</option>
            {DISTRICTS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </header>

      {isError && (
        <ErrorMessage
          title="The dashboard could not be loaded"
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {isPending && !isError && <Spinner label="Loading fleet statistics…" />}

      {stats && !isError && (
        <>
          <section className="dashboard__stats" aria-label="Fleet statistics" aria-busy={isFetching}>
            {statistics.map((stat) => (
              <Link key={stat.key} className={`stat-card stat-card--${stat.tone ?? 'default'}`} to={stat.to}>
                <span className="stat-card__label">{stat.label}</span>
                <span className="stat-card__value">{stat.value}</span>
                <span className="stat-card__hint">{stat.hint}</span>
              </Link>
            ))}
          </section>

          {stats.total === 0 ? (
            <p className="dashboard__empty">
              No vehicles are based in {district}. <Link to="/dashboard">Show the whole fleet</Link>.
            </p>
          ) : (
            <div className="dashboard__breakdowns">
              <StatBreakdown
                title="By status"
                total={stats.total}
                rows={VEHICLE_STATUSES.map((status) => ({
                  key: status,
                  label: STATUS_LABELS[status],
                  count: stats.byStatus[status],
                  tone: status,
                  to: listLink({ ...scopeSuffix, status }),
                }))}
              />
              <StatBreakdown
                title="By class"
                total={stats.total}
                rows={VEHICLE_CLASSES.map((vehicleClass) => ({
                  key: vehicleClass,
                  label: CLASS_LABELS[vehicleClass],
                  count: stats.byClass[vehicleClass],
                  to: listLink({ ...scopeSuffix, class: vehicleClass }),
                }))}
              />
              {district === 'all' && (
                <StatBreakdown
                  title="By district"
                  total={stats.total}
                  rows={DISTRICTS.map((name) => ({
                    key: name,
                    label: name,
                    count: stats.byDistrict[name] ?? 0,
                    to: listLink({ district: name }),
                  }))}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
