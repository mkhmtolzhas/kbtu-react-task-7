import {
  MIN_FUEL_TO_RENT,
  PAGE_SIZES,
  SORT_FIELDS,
  STATUS_LABELS,
  VEHICLE_CLASSES,
  VEHICLE_STATUSES,
} from '../utils/constants.js';
import { validateVehicle } from '../utils/validation.js';
import { isLowFuel, isServiceOverdue, normalizePlate, statusesForClass } from '../utils/vehicle.js';
import { fleetUrl, vehicleUrl } from './endpoints.js';
import { fetchJson } from './http.js';
import { ApiError, simulateNetwork } from './network.js';
import {
  isDeleted,
  mergeFleet,
  overlayVehicle,
  removeVehicle,
  saveVehicle,
  takeNextId,
} from './overlay.js';

const SORTABLE_FIELDS = SORT_FIELDS.map((field) => field.value);
const HISTORY_LIMIT = 10;
const MAX_PAGE_SIZE = Math.max(...PAGE_SIZES);

// The API hands out copies so the UI can never mutate the "database" by accident.
const clone = (value) => structuredClone(value);

/**
 * The fleet: the public catalogue fetched over HTTP, with this browser's own
 * changes merged on top.
 *
 * The request goes through the service worker, which answers it
 * stale-while-revalidate — so a visitor who has been here before gets the list
 * instantly and keeps it when the connection is gone.
 */
async function loadFleet({ signal } = {}) {
  const { data, meta } = await fetchJson(fleetUrl(), { signal });
  return { vehicles: mergeFleet(data.vehicles), catalogueCount: data.count, meta };
}

function matchesSearch(vehicle, search) {
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [
    vehicle.plate,
    vehicle.plate.replaceAll(' ', ''),
    vehicle.brand,
    vehicle.model,
  ].join(' ').toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function compareVehicles(sortBy, sortDir) {
  const direction = sortDir === 'desc' ? -1 : 1;
  return (a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    const result = typeof left === 'string' ? left.localeCompare(right) : left - right;
    // Tie-break by id so pagination is stable for equal values.
    return result !== 0 ? result * direction : a.id.localeCompare(b.id);
  };
}

/**
 * Search, filtering, sorting and pagination of the fleet.
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number, meta: object }>}
 */
export async function listVehicles(params = {}, { signal } = {}) {
  await simulateNetwork(signal);
  const { vehicles, meta } = await loadFleet({ signal });

  const {
    search = '',
    status = 'all',
    vehicleClass = 'all',
    district = 'all',
    sortBy = 'plate',
    sortDir = 'asc',
  } = params;
  const page = Math.max(1, Math.trunc(Number(params.page) || 1));
  const pageSize = Math.min(Math.max(1, Math.trunc(Number(params.pageSize) || PAGE_SIZES[0])), MAX_PAGE_SIZE);
  const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'plate';

  const filtered = vehicles.filter((vehicle) =>
    (status === 'all' || vehicle.status === status)
    && (vehicleClass === 'all' || vehicle.class === vehicleClass)
    && (district === 'all' || vehicle.district === district)
    && matchesSearch(vehicle, search));

  const sorted = [...filtered].sort(compareVehicles(sortField, sortDir));
  const start = (page - 1) * pageSize;

  return {
    items: clone(sorted.slice(start, start + pageSize)),
    total: filtered.length,
    page,
    pageSize,
    meta,
  };
}

/**
 * One vehicle — the "details" request of the public API.
 *
 * A vehicle the dispatcher created or edited lives only in this browser, so it is
 * answered from the overlay. Everything else is fetched by id; if that request
 * cannot be answered (offline, and this particular file was never cached), the
 * vehicle is taken from the catalogue, which usually *is* cached.
 */
export async function getVehicle(id, { signal } = {}) {
  await simulateNetwork(signal);

  if (isDeleted(id)) throw new ApiError(`Vehicle "${id}" was not found.`, { status: 404 });

  const local = overlayVehicle(id);
  if (local) return clone(local);

  try {
    const { data } = await fetchJson(vehicleUrl(id), { signal });
    return clone(data);
  } catch (error) {
    if (error.status === 404) {
      throw new ApiError(`Vehicle "${id}" was not found.`, { status: 404 });
    }
    const { vehicles } = await loadFleet({ signal });
    const vehicle = vehicles.find((item) => item.id === id);
    if (!vehicle) throw error;
    return clone(vehicle);
  }
}

/**
 * Fleet-wide numbers for the summary tiles and the dashboard.
 * `district` narrows every number to one district without touching the list view.
 */
export async function getFleetStats(params = {}, { signal } = {}) {
  await simulateNetwork(signal);
  const { vehicles, meta } = await loadFleet({ signal });

  const district = params.district ?? 'all';
  const scope = district === 'all'
    ? vehicles
    : vehicles.filter((vehicle) => vehicle.district === district);

  const byStatus = Object.fromEntries(VEHICLE_STATUSES.map((status) => [status, 0]));
  const byClass = Object.fromEntries(VEHICLE_CLASSES.map((vehicleClass) => [vehicleClass, 0]));
  const byDistrict = {};
  let lowFuel = 0;
  let serviceOverdue = 0;
  let priceSum = 0;

  for (const vehicle of scope) {
    byStatus[vehicle.status] += 1;
    byClass[vehicle.class] += 1;
    byDistrict[vehicle.district] = (byDistrict[vehicle.district] ?? 0) + 1;
    if (isLowFuel(vehicle.fuelLevel)) lowFuel += 1;
    if (isServiceOverdue(vehicle.lastServiceDate)) serviceOverdue += 1;
    priceSum += vehicle.pricePerMinute;
  }

  return {
    total: scope.length,
    fleetTotal: vehicles.length,
    byStatus,
    byClass,
    byDistrict,
    lowFuel,
    serviceOverdue,
    averagePricePerMinute: scope.length === 0 ? 0 : Math.round(priceSum / scope.length),
    district,
    meta,
  };
}

export async function createVehicle(data) {
  await simulateNetwork();
  const { vehicles, catalogueCount } = await loadFleet();

  const fieldErrors = validateVehicle(data);
  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('Some fields are invalid.', { status: 422, fieldErrors });
  }

  const plate = normalizePlate(data.plate);
  if (vehicles.some((vehicle) => vehicle.plate === plate)) {
    throw new ApiError('A vehicle with this plate already exists.', {
      status: 409,
      fieldErrors: { plate: `${plate} is already registered in the fleet.` },
    });
  }

  const vehicle = {
    id: takeNextId(catalogueCount),
    plate,
    brand: data.brand,
    model: data.model.trim(),
    class: data.class,
    status: data.status,
    district: data.district,
    fuelLevel: Number(data.fuelLevel),
    mileageKm: Number(data.mileageKm),
    pricePerMinute: Number(data.pricePerMinute),
    year: Number(data.year),
    lastServiceDate: data.lastServiceDate,
    notes: String(data.notes ?? '').trim(),
    statusHistory: [{ status: data.status, changedAt: new Date().toISOString() }],
  };

  saveVehicle(vehicle);
  return clone(vehicle);
}

export async function updateVehicleStatus(id, status) {
  await simulateNetwork();
  const { vehicles } = await loadFleet();
  const vehicle = vehicles.find((item) => item.id === id);

  if (!vehicle) throw new ApiError(`Vehicle "${id}" was not found.`, { status: 404 });
  if (!statusesForClass(vehicle.class).includes(status)) {
    throw new ApiError(`A ${vehicle.class} vehicle cannot be set to "${status}".`, { status: 422 });
  }
  if (status === vehicle.status) {
    throw new ApiError(`The vehicle is already ${STATUS_LABELS[status].toLowerCase()}.`, { status: 409 });
  }
  if (status === 'rented' && vehicle.fuelLevel < MIN_FUEL_TO_RENT) {
    throw new ApiError(
      `Cannot rent out a vehicle below ${MIN_FUEL_TO_RENT} % fuel/charge. Refuel or charge it first.`,
      { status: 422 },
    );
  }

  const updated = {
    ...vehicle,
    status,
    statusHistory: [
      { status, changedAt: new Date().toISOString() },
      ...vehicle.statusHistory,
    ].slice(0, HISTORY_LIMIT),
  };

  saveVehicle(updated);
  return clone(updated);
}

export async function deleteVehicle(id) {
  await simulateNetwork();
  const { vehicles } = await loadFleet();
  const vehicle = vehicles.find((item) => item.id === id);

  if (!vehicle) throw new ApiError(`Vehicle "${id}" was not found.`, { status: 404 });
  if (vehicle.status === 'rented') {
    throw new ApiError('A rented vehicle cannot be removed from the fleet. End the rental first.', {
      status: 409,
    });
  }

  removeVehicle(id);
  return { id };
}
