// Local changes on top of the public catalogue.
//
// The catalogue (`api/fleet.json`) is read-only and shared by everyone, so every
// change a dispatcher makes — a new vehicle, a status change, a removal — is kept
// in this browser as an overlay and merged over the fetched data. Two things fall
// out of that: the fleet stays editable while completely offline, and a redeploy
// of the catalogue never silently drops the user's own work.
//
// This module is the only place in the app that touches localStorage.

const STORAGE_KEY = 'fleetdesk.overlay';

// Bump when the shape below changes: every browser then drops its old overlay.
const SCHEMA_VERSION = 1;

// Used when localStorage is unavailable (private mode, quota exceeded).
let memoryOverlay = null;

function emptyOverlay() {
  return { version: SCHEMA_VERSION, nextId: 0, changed: {}, deleted: [] };
}

function isValid(overlay) {
  return overlay?.version === SCHEMA_VERSION
    && Number.isInteger(overlay.nextId)
    && overlay.changed && typeof overlay.changed === 'object'
    && Array.isArray(overlay.deleted);
}

export function loadOverlay() {
  if (memoryOverlay) return memoryOverlay;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    return isValid(stored) ? stored : emptyOverlay();
  } catch {
    return emptyOverlay();
  }
}

export function saveOverlay(overlay) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
    memoryOverlay = null;
  } catch {
    memoryOverlay = overlay;
  }
}

/**
 * The fleet as the dispatcher sees it: the catalogue, minus what was removed,
 * with locally changed vehicles replaced and locally created ones appended.
 */
export function mergeFleet(catalogue) {
  const { changed, deleted } = loadOverlay();
  const removed = new Set(deleted);
  const fromCatalogue = new Set();
  const merged = [];

  for (const vehicle of catalogue) {
    if (removed.has(vehicle.id)) continue;
    fromCatalogue.add(vehicle.id);
    merged.push(changed[vehicle.id] ?? vehicle);
  }

  for (const [id, vehicle] of Object.entries(changed)) {
    if (!fromCatalogue.has(id) && !removed.has(id)) merged.push(vehicle);
  }

  return merged;
}

/** A vehicle the user created or edited, if there is one. */
export function overlayVehicle(id) {
  return loadOverlay().changed[id] ?? null;
}

export function isDeleted(id) {
  return loadOverlay().deleted.includes(id);
}

export function saveVehicle(vehicle) {
  const overlay = loadOverlay();
  saveOverlay({
    ...overlay,
    changed: { ...overlay.changed, [vehicle.id]: vehicle },
    deleted: overlay.deleted.filter((id) => id !== vehicle.id),
  });
}

export function removeVehicle(id) {
  const overlay = loadOverlay();
  const changed = { ...overlay.changed };
  delete changed[id];
  saveOverlay({
    ...overlay,
    changed,
    deleted: overlay.deleted.includes(id) ? overlay.deleted : [...overlay.deleted, id],
  });
}

/**
 * The next free id. Ids continue the catalogue's numbering (`veh-0181`, …) and
 * never go backwards, even after the vehicle that used the previous one is gone.
 */
export function takeNextId(catalogueCount) {
  const overlay = loadOverlay();
  const next = Math.max(overlay.nextId, catalogueCount + 1);
  saveOverlay({ ...overlay, nextId: next + 1 });
  return `veh-${String(next).padStart(4, '0')}`;
}
