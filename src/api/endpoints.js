import { SW_CONTRACT } from '../pwa/swContract.js';

// `base: './'` in vite.config.js means the app must work both at a domain root
// (Vercel) and in a sub-folder (GitHub Pages). Every URL is therefore resolved
// against the directory of the document, computed once.
//
// `new URL('.', …)` drops the hash, so `https://host/#/vehicles/veh-0001`
// resolves to `https://host/` exactly like a plain `https://host/` would.
const APP_ROOT = new URL('.', document.baseURI).href;

export function appUrl(path) {
  return new URL(path, APP_ROOT).href;
}

/** The whole public catalogue: one request, cached by the worker. */
export function fleetUrl() {
  return appUrl(`${SW_CONTRACT.apiPath}fleet.json`);
}

/** A single vehicle — the "details" request of the public API. */
export function vehicleUrl(id) {
  return appUrl(`${SW_CONTRACT.apiPath}vehicles/${encodeURIComponent(id)}.json`);
}

/** Connectivity probe target. The worker deliberately never answers this one. */
export function pingUrl() {
  return appUrl(SW_CONTRACT.pingPath);
}
