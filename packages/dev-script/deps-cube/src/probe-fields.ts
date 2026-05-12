/**
 * Field-level probes and helpers used by the probe orchestrator.
 *
 * Each field probe fetches a single attribute (registry manifest, downloads
 * count, Linguist languages, last-commit date, transitive count) and writes
 * its result to the file cache with the appropriate TTL. The orchestrator
 * in {@link ../probe.ts} composes these into a {@link ../probe.ts#PackageProbe}.
 *
 * @example
 * ```ts
 * const pkg = await probePackageManifest({ npmName: 'preact', cache });
 * const dl = await probeDownloads({ npmName: 'preact', cache });
 * ```
 */

import spawn from 'nano-spawn';

import type { Cache, } from './cache.ts';

//region Public types (used by orchestrator)

/**
 * Subset of npm registry package-level response that the probe consumes.
 */
export type NpmPackage = {
  'dist-tags'?: { latest?: string; };
  time?: { created?: string; };
  versions?: Record<string, NpmVersion>;
};

/**
 * Subset of one version's manifest.
 */
export type NpmVersion = {
  repository?:
    | string
    | { type?: string; url?: string; directory?: string; };
  dependencies?: Record<string, string>;
  dist?: { unpackedSize?: number; };
  license?: string | { type?: string; };
};

/**
 * Output of `repository` normalisation.
 */
export type RepositoryInfo = {
  host: 'github' | 'other';
  owner: string;
  repo: string;
  directory?: string | undefined;
  /** The raw URL we parsed, useful for the tooltip. */
  url: string;
} | null;

/**
 * License classes used for filter/color groupings.
 */
export type LicenseClass = 'permissive' | 'copyleft' | 'non-oss' | 'unknown';

//endregion Public types

//region Constants

/** Indefinite cache TTL marker. */
const TTL_FOREVER: number | null = null;
/** 30-day TTL for fields that can change with upstream activity. */
const TTL_30_DAYS = 30 * 24 * 60 * 60 * 1000;
/** Per-HTTP-request timeout in ms. */
const HTTP_TIMEOUT_MS = 30_000;

/** Permissive license SPDX identifiers (uppercase). */
const PERMISSIVE_LICENSES = new Set([
  'MIT',
  'BSD-2-CLAUSE',
  'BSD-3-CLAUSE',
  'APACHE-2.0',
  'ISC',
  '0BSD',
  'CC0-1.0',
  'UNLICENSE',
],);

//endregion Constants

//region Repository normalisation

/**
 * Extracts GitHub `{owner, repo}` from heterogeneous npm `repository` fields.
 *
 * Handles plain strings, `{url, directory}` objects, `github:owner/repo`
 * shortcuts, `git+https://...`, `git@github.com:owner/repo.git`. Returns
 * `null` when no parseable repo URL is present; non-GitHub hosts return
 * `{host: 'other', ...}` so the caller can mark TS/SLOC unknown.
 *
 * @param repoField - Raw `repository` value from the version manifest.
 *
 * @returns Parsed repository info or `null`.
 */
export function parseRepository(repoField: NpmVersion['repository'],): RepositoryInfo {
  if (repoField === undefined || repoField === null) return null;

  const rawString = typeof repoField === 'string' ? repoField : (repoField.url ?? '');
  const directory = typeof repoField === 'string' ? undefined : repoField.directory;

  if (rawString === '') return null;

  const shortMatch = /^github:([^/]+)\/(.+?)(?:\.git)?$/i.exec(rawString,);
  if (shortMatch !== null) {
    const [, owner, repo,] = shortMatch;
    if (owner === undefined || repo === undefined) return null;
    return {
      host: 'github',
      owner,
      repo,
      directory,
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  const githubUrlPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:[/?#].*)?$/i;
  const match = githubUrlPattern.exec(rawString,);
  if (match !== null) {
    const [, owner, repo,] = match;
    if (owner === undefined || repo === undefined) return null;
    return {
      host: 'github',
      owner,
      repo,
      directory,
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  return {
    host: 'other',
    owner: '',
    repo: '',
    directory,
    url: rawString,
  };
}

//endregion Repository normalisation

//region Version resolution

/**
 * Picks a concrete version that satisfies the catalog range.
 *
 * Heuristic: pinned versions (no leading operator) are used as-is; otherwise
 * `dist-tags.latest` is used. Acceptable for an audit overview; documented
 * limitation in `docs/decisions/deps-cube.md`.
 *
 * @param range - Range string from the catalog.
 * @param pkg - Package-level npm registry response.
 *
 * @returns Concrete version string, or `undefined` if neither pin nor latest resolves.
 */
export function resolveVersion(
  {
    range,
    pkg,
  }: {
    range: string;
    pkg: NpmPackage;
  },
): string | undefined {
  if (/^\d+\.\d+\.\d+/.test(range,) && pkg.versions?.[range] !== undefined) return range;
  return pkg['dist-tags']?.latest;
}

//endregion Version resolution

//region License classification

/**
 * Reduces SPDX license strings to coarse audit categories.
 *
 * @param license - Raw `license` field from the version manifest.
 *
 * @returns One of `permissive`, `copyleft`, `non-oss`, or `unknown`.
 */
export function classifyLicense(license: NpmVersion['license'],): LicenseClass {
  const raw = (typeof license === 'string' ? license : license?.type ?? '').toUpperCase().trim();
  if (raw === '') return 'unknown';
  if (PERMISSIVE_LICENSES.has(raw,)) return 'permissive';
  if (raw.startsWith('GPL',) || raw.startsWith('LGPL',) || raw.startsWith('AGPL',) || raw.includes('COPYLEFT',))
    return 'copyleft';
  if (raw === 'UNLICENSED' || raw.startsWith('SEE LICENSE',) || raw.startsWith('PROPRIETARY',))
    return 'non-oss';
  return 'unknown';
}

//endregion License classification

//region HTTP helpers

/**
 * Fetches a URL with a hard timeout, returning the JSON response.
 *
 * @param url - Absolute URL to fetch.
 *
 * @returns Parsed JSON value.
 *
 * @throws When the request times out, network errors, or HTTP status is not 2xx.
 */
async function fetchJson<T>(url: string,): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS,), },);
  if (!response.ok) throw new Error(`HTTP ${response.status.toString()} on ${url}`,);
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- response.json() is `unknown`; caller asserts T.
  return await response.json() as T;
}

/**
 * Runs a `gh api` invocation and parses the result as JSON.
 *
 * @param path - The API path (e.g. `repos/{owner}/{repo}/languages`).
 *
 * @returns Parsed JSON response; throws on non-zero exit or parse failure.
 *
 * @throws When `gh` exits non-zero (rate limit, auth failure, not found).
 */
async function ghApi<T>(path: string,): Promise<T> {
  const result = await spawn('gh', ['api', path,], { timeout: HTTP_TIMEOUT_MS, },);
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns `any`; caller asserts T.
  return JSON.parse(result.stdout,) as T;
}

//endregion HTTP helpers

//region Field probes

/**
 * Fetches the package-level npm registry manifest (all versions + time).
 *
 * @param npmName - Real npm package name.
 * @param cache - File cache handle.
 *
 * @returns Package-level npm manifest.
 *
 * @example
 * ```ts
 * const pkg = await probePackageManifest({ npmName: 'preact', cache });
 * ```
 */
export async function probePackageManifest(
  {
    npmName,
    cache,
  }: {
    npmName: string;
    cache: Cache;
  },
): Promise<NpmPackage> {
  const cached = await cache.read<NpmPackage>({
    name: npmName,
    version: '_pkg',
    field: 'registry',
    ttlMs: TTL_30_DAYS,
  },);
  if (cached !== undefined) return cached;
  const fetched = await fetchJson<NpmPackage>(
    `https://registry.npmjs.org/${encodeURIComponent(npmName,).replace(/%40/g, '@',)}`,
  );
  await cache.write({
    name: npmName,
    version: '_pkg',
    field: 'registry',
    value: fetched,
  },);
  return fetched;
}

/**
 * Fetches last-week downloads. Returns `0` on error or for niche packages.
 *
 * @param npmName - Real npm package name.
 * @param cache - File cache handle.
 *
 * @returns Weekly download count.
 *
 * @example
 * ```ts
 * const dl = await probeDownloads({ npmName: 'preact', cache });
 * ```
 */
export async function probeDownloads(
  {
    npmName,
    cache,
  }: {
    npmName: string;
    cache: Cache;
  },
): Promise<number> {
  const cached = await cache.read<{ downloads: number; }>({
    name: npmName,
    version: '_pkg',
    field: 'downloads',
    ttlMs: TTL_30_DAYS,
  },);
  if (cached !== undefined) return cached.downloads;
  try {
    const fetched = await fetchJson<{ downloads: number; }>(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(npmName,).replace(/%40/g, '@',)}`,
    );
    await cache.write({
      name: npmName,
      version: '_pkg',
      field: 'downloads',
      value: fetched,
    },);
    return fetched.downloads;
  } catch {
    return 0;
  }
}

/**
 * Calls Linguist for a GH repo, returning the language→bytes map.
 *
 * @param owner - GitHub owner.
 * @param repo - GitHub repo name.
 * @param cache - File cache handle.
 *
 * @returns `null` when the API errors (private, 404, rate-limited).
 *
 * @example
 * ```ts
 * const langs = await probeLanguages({ owner: 'preactjs', repo: 'preact', cache });
 * ```
 */
export async function probeLanguages(
  {
    owner,
    repo,
    cache,
  }: {
    owner: string;
    repo: string;
    cache: Cache;
  },
): Promise<Record<string, number> | null> {
  const key = `${owner}/${repo}`;
  const cached = await cache.read<Record<string, number>>({
    name: key,
    version: '_repo',
    field: 'languages',
    ttlMs: TTL_FOREVER,
  },);
  if (cached !== undefined) return cached;
  try {
    const fetched = await ghApi<Record<string, number>>(`repos/${owner}/${repo}/languages`,);
    await cache.write({
      name: key,
      version: '_repo',
      field: 'languages',
      value: fetched,
    },);
    return fetched;
  } catch {
    return null;
  }
}

/**
 * Fetches `pushed_at` (whole-repo last commit) when no directory is given,
 * or the most recent commit's date in `directory` otherwise.
 *
 * @param owner - GitHub owner.
 * @param repo - GitHub repo name.
 * @param directory - Subdirectory for monorepo-housed packages; whole-repo if omitted.
 * @param cache - File cache handle.
 *
 * @returns ISO timestamp string or `null` when the API errors out.
 *
 * @example
 * ```ts
 * const date = await probeLastCommit({ owner: 'lezer-parser', repo: 'common', directory: undefined, cache });
 * ```
 */
export async function probeLastCommit(
  {
    owner,
    repo,
    directory,
    cache,
  }: {
    owner: string;
    repo: string;
    directory?: string | undefined;
    cache: Cache;
  },
): Promise<string | null> {
  const key = `${owner}/${repo}`;
  const field = directory === undefined ? 'pushed_at' : `commits:${directory}`;
  const cached = await cache.read<string>({
    name: key,
    version: '_repo',
    field,
    ttlMs: TTL_30_DAYS,
  },);
  if (cached !== undefined) return cached;

  try {
    if (directory === undefined) {
      const repoMeta = await ghApi<{ pushed_at: string; }>(`repos/${owner}/${repo}`,);
      await cache.write({
        name: key,
        version: '_repo',
        field,
        value: repoMeta.pushed_at,
      },);
      return repoMeta.pushed_at;
    }
    const commits = await ghApi<readonly { commit?: { author?: { date?: string; }; }; }[]>(
      `repos/${owner}/${repo}/commits?path=${encodeURIComponent(directory,)}&per_page=1`,
    );
    const date = commits[0]?.commit?.author?.date;
    if (date === undefined) return null;
    await cache.write({
      name: key,
      version: '_repo',
      field,
      value: date,
    },);
    return date;
  } catch {
    return null;
  }
}

//endregion Field probes
