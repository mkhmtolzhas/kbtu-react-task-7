// Generates the public, read-only catalogue served as static JSON.
//
// Why this exists: a service worker can only cache what travels over HTTP, and the
// simulated API used to keep its data in localStorage, where no worker can see it.
// The data is therefore published as real files — the API layer still adds the
// delays, failures, cancellation and validation that make it behave like a server.
//
// Deterministic: the same seed produces the same catalogue on every build.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVehicles } from '../src/api/seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'public', 'api');
const vehiclesDir = path.join(apiDir, 'vehicles');

const vehicles = generateVehicles();
const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  count: vehicles.length,
  vehicles,
};

await rm(apiDir, { recursive: true, force: true });
await mkdir(vehiclesDir, { recursive: true });

// The list endpoint: one request holds the whole fleet, so a single cached answer
// is enough to browse, search and filter with no connection at all.
await writeFile(path.join(apiDir, 'fleet.json'), `${JSON.stringify(payload)}\n`);

// The details endpoints: one file per vehicle, cached on demand.
await Promise.all(vehicles.map((vehicle) =>
  writeFile(path.join(vehiclesDir, `${vehicle.id}.json`), `${JSON.stringify(vehicle)}\n`)));

process.stdout.write(`api: wrote fleet.json + ${vehicles.length} vehicle files\n`);
