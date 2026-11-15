import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SW_CONTRACT } from '../src/pwa/swContract.js';

/**
 * Builds the service worker.
 *
 * The worker needs to know the exact names of the built JS and CSS files, which
 * only exist after Rollup has hashed them. This plugin waits for that moment,
 * substitutes three placeholders in `src/sw/sw.js` and emits the result as an
 * unhashed `sw.js` at the root of `dist`.
 *
 * Two details that matter:
 *
 * - `fileName` (not `name`) keeps the file unhashed and at the root. A worker's
 *   scope cannot be wider than its own URL, so a worker in `assets/` could never
 *   control the application.
 * - Precache paths are stored *relative*, because `base: './'` lets the same
 *   build run at a domain root and in a sub-folder. The worker resolves them
 *   against its own location.
 */
export default function serviceWorkerPlugin({ swSrc, extraPrecache = [] } = {}) {
  let config;

  return {
    name: 'fleetdesk:service-worker',
    apply: 'build',
    enforce: 'post',

    configResolved(resolved) {
      config = resolved;
    },

    generateBundle(_options, bundle) {
      this.addWatchFile(swSrc);

      const built = Object.keys(bundle).filter((file) => /\.(js|css)$/.test(file));

      // Files in public/ are copied after the bundle is written and never appear
      // in `bundle`, so they are listed by hand and verified on disk — a missing
      // entry would make install() reject and the worker would never activate.
      const fromPublic = extraPrecache.filter((file) => {
        if (fs.existsSync(path.join(config.publicDir, file))) return true;
        this.warn(`precache entry "${file}" is missing from public/`);
        return false;
      });

      const entries = ['index.html', ...built, ...fromPublic].sort();

      // The version is a hash of the precache list, so an unchanged rebuild emits
      // a byte-identical sw.js and the browser reports no update. Build-time
      // stamps (Date.now()) would show an "update available" prompt every deploy.
      const digest = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0, 8);
      const pkg = JSON.parse(fs.readFileSync(path.join(config.root, 'package.json'), 'utf8'));

      // replaceAll, not replace: a placeholder mentioned twice (in a comment and
      // in the code) must not leave one of them unsubstituted.
      const source = fs.readFileSync(swSrc, 'utf8')
        .replaceAll('__PRECACHE_MANIFEST__', JSON.stringify(entries))
        .replaceAll('__SW_VERSION__', `${pkg.version}-${digest}`)
        .replaceAll('__SW_CONTRACT__', JSON.stringify(SW_CONTRACT));

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
