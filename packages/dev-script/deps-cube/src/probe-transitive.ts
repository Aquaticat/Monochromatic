/**
 * Depth-bounded transitive dep count via the npm registry.
 *
 * Walks `dependencies` of each package's latest manifest, counting distinct
 * `name@version` pairs reachable within {@link TRANSITIVE_DEPTH_CAP}. Cycles
 * are broken via the `visited` set. Per-(name, version) counts are cached
 * with a 30-day TTL.
 *
 * Separated from `probe-fields.ts` to keep that file under the 300-line cap.
 *
 * @example
 * ```ts
 * const count = await probeTransitive({
 *   name: 'preact',
 *   version: '10.26.0',
 *   cache,
 *   visited: new Set(),
 *   depth: 0,
 * });
 * ```
 */

import type { Cache, } from './cache.ts';
import { probePackageManifest, } from './probe-fields.ts';
import type { NpmPackage, } from './probe-fields.ts';

//region Constants

/** Depth cap for transitive dep walks. */
const TRANSITIVE_DEPTH_CAP = 5;
/** 30-day TTL for cached transitive counts. */
const TTL_30_DAYS = 30 * 24 * 60 * 60 * 1000;

//endregion Constants

//region Helpers

/**
 * Wraps {@link probePackageManifest} so registry-fetch failures during the
 * transitive walk return `null` instead of throwing.
 *
 * @param npmName - npm package name.
 * @param cache - File cache handle.
 *
 * @returns Manifest, or `null` on any fetch error.
 */
async function readManifestSilent(
  {
    npmName,
    cache,
  }: {
    npmName: string;
    cache: Cache;
  },
): Promise<NpmPackage | null> {
  try {
    return await probePackageManifest({
      npmName,
      cache,
    },);
  } catch {
    return null;
  }
}

//endregion Helpers

//region Public API

/**
 * Best-effort transitive dep count via a depth-bounded registry walk.
 *
 * @param name - npm package name.
 * @param version - Concrete version.
 * @param cache - File cache handle.
 * @param visited - Set of already-visited `name@version` keys.
 * @param depth - Current recursion depth (caller passes `0` initially).
 *
 * @returns Count of distinct packages reachable via `dependencies` within depth cap.
 *
 * @example
 * ```ts
 * const count = await probeTransitive({ name: 'preact', version: '10.26.0', cache, visited: new Set(), depth: 0 });
 * ```
 */
export async function probeTransitive(
  {
    name,
    version,
    cache,
    visited,
    depth,
  }: {
    name: string;
    version: string;
    cache: Cache;
    visited: Set<string>;
    depth: number;
  },
): Promise<number> {
  const key = `${name}@${version}`;
  if (visited.has(key,)) return 0;
  visited.add(key,);
  if (depth >= TRANSITIVE_DEPTH_CAP) return 0;

  const cached = await cache.read<number>({
    name,
    version,
    field: 'transitive',
    ttlMs: TTL_30_DAYS,
  },);
  if (cached !== undefined) return cached;

  const manifest = await readManifestSilent({
    npmName: name,
    cache,
  },);
  if (manifest === null) return 0;
  const versionManifest = manifest.versions?.[version] ?? Object.values(manifest.versions ?? {},)[0];
  const deps = versionManifest?.dependencies ?? {};
  const directNames = Object.keys(deps,);

  const subCounts = await Promise.all(directNames.map(
    async function recurseOne(depName,) {
      const depPkg = await readManifestSilent({
        npmName: depName,
        cache,
      },);
      if (depPkg === null) return 0;
      const depVersion = depPkg['dist-tags']?.latest;
      if (depVersion === undefined) return 0;
      return 1 + await probeTransitive({
        name: depName,
        version: depVersion,
        cache,
        visited,
        depth: depth + 1,
      },);
    },
  ),);
  const total = subCounts.reduce(
    function add(
      a,
      b,
    ) {
      return a + b;
    },
    0,
  );
  await cache.write({
    name,
    version,
    field: 'transitive',
    value: total,
  },);
  return total;
}

//endregion Public API
