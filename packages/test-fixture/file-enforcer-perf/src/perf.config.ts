/**
 * Performance benchmark configuration for file-enforcer.
 * Exercises all major operations: cat (array + glob), overwrite,
 * overwriteEach, dedup, getProperty, and deep glob traversal.
 *
 * Writes ~68 destination files from ~240 source files.
 * Run via `bun perf.config.ts` after setup-fixture.ts creates the fixture.
 */

import {
  cat,
  dedup,
  getProperty,
  overwrite,
  overwriteEach,
  readCache,
  reset,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

// Reset tracker so each run starts clean (critical for watch mode and repeated benchmarks)
reset();
// Log cache stats for benchmark diagnostics
console.error(`[perf.config] readCache size: ${String(readCache.size)} entries`);

/** Absolute path to the fixture root */
const BASE = '/tmp/file-enforcer-perf';
const SRC = `${BASE}/src`;
const DEST = `${BASE}/dest`;

/**
 * Returns the fixture path for a package by index.
 * @param pkgIndex - Package index (0-19)
 * @returns Absolute path to the package directory
 */
function pkgPath(pkgIndex: number): string {
  return `${SRC}/pkg-${String(pkgIndex).padStart(2, '0')}`;
}

/** Number of packages per concat group */
const PACKAGES_PER_GROUP = 4;
/** Total concat groups (5 groups * 4 packages = 20 packages covered) */
const CONCAT_GROUP_COUNT = 5;

//region All rules -- single Promise.all to minimize CFS yield points

/** Glob mirror configurations: source subdirectory + filename */
const MIRROR_CONFIGS = [
  { dir: 'lib', file: 'index.ts' },
  { dir: 'lib', file: 'utils.ts' },
  { dir: 'types', file: 'index.d.ts' },
] as const;

/** All readme paths for the dedup rule */
const allReadmeSources = Array.from(
  { length: 20 },
  (_, pkgIndex) => `${pkgPath(pkgIndex)}/docs/readme.md`,
);

/** Deep glob patterns for 6-level nested mirroring */
const deepSourceGlob = `${SRC}/pkg-*/lib/deep/nested/very/deep/module.ts`;
const deepDestGlob = `${DEST}/deep-mirror/*/module.ts`;

await Promise.all([
  // Concat rules -- combine readme.md from groups of 4 packages
  ...Array.from({ length: CONCAT_GROUP_COUNT }, async (_, groupIndex) => {
    /** Source readme paths for this group of 4 packages */
    const sources = Array.from(
      { length: PACKAGES_PER_GROUP },
      (_, pkgOffset) => `${pkgPath(groupIndex * PACKAGES_PER_GROUP + pkgOffset)}/docs/readme.md`,
    );
    const content = await cat(sources);
    await overwrite(`${DEST}/combined-${String(groupIndex)}.md`, content);
  }),

  // Glob mirror rules -- mirror lib and type files across packages
  ...MIRROR_CONFIGS.map(async ({ dir, file }) => {
    const sourceGlob = `${SRC}/pkg-*/${dir}/${file}`;
    const destGlob = `${DEST}/mirror-${dir}/*/${file}`;
    const files = await cat(sourceGlob);
    await overwriteEach(destGlob, sourceGlob, files);
  }),

  // GetProperty extractions -- parse JSON and extract nested values
  (async (): Promise<void> => {
    const content = await cat([`${pkgPath(0)}/config/settings.json`]);
    await overwrite(`${DEST}/name-0.txt`, getProperty('.name', content));
  })(),
  (async (): Promise<void> => {
    const content = await cat([`${pkgPath(1)}/config/settings.json`]);
    await overwrite(`${DEST}/features-1.txt`, getProperty('.config.features', content));
  })(),

  // Dedup -- combine all 20 readmes and remove duplicate lines
  (async (): Promise<void> => {
    const allReadmes = await cat(allReadmeSources);
    await overwrite(`${DEST}/all-readmes-deduped.md`, dedup(allReadmes));
  })(),

  // Deep glob -- mirror 6-level nested files
  (async (): Promise<void> => {
    const deepFiles = await cat(deepSourceGlob);
    await overwriteEach(deepDestGlob, deepSourceGlob, deepFiles);
  })(),
]);

//endregion All rules
