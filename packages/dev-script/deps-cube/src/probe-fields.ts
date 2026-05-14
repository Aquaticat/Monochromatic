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

import {
  MS_PER_DAY,
  MS_PER_SECOND,
} from '@monochromatic-dev/module-numeric-const';

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
    | {
      type?: string;
      url?: string;
      directory?: string;
    };
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
/** Days of validity for fields that can change with upstream activity. */
const TTL_DAYS = 30;
/** TTL in ms for fields that can change with upstream activity. */
const TTL_MS = TTL_DAYS * MS_PER_DAY;
/** HTTP timeout in seconds; lets `gh api` complete on slow links without hanging an audit. */
const HTTP_TIMEOUT_SECONDS = 30;
/** Per-HTTP-request timeout in ms. */
const HTTP_TIMEOUT_MS = HTTP_TIMEOUT_SECONDS * MS_PER_SECOND;

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
 *
 * @example
 * ```ts
 * parseRepository({ type: 'git', url: 'git+https://github.com/preactjs/preact.git' });
 * // { host: 'github', owner: 'preactjs', repo: 'preact', directory: undefined, url: 'https://github.com/preactjs/preact' }
 * parseRepository('github:lezer-parser/common');
 * // { host: 'github', owner: 'lezer-parser', repo: 'common', directory: undefined, url: 'https://github.com/lezer-parser/common' }
 * ```
 */
export function parseRepository(repoField: NpmVersion['repository'],): RepositoryInfo {
  if ((repoField === undefined) || (repoField === null)) return null;

  /** `true` when the `repository` field is a plain string (vs the `{url, ...}` object form). */
  const isStringForm = (typeof repoField) === 'string';
  /** Unified string form of the `repository` value, regardless of plain-string or object shape. */
  const rawString = isStringForm ? repoField : (repoField.url ?? '');
  /** Optional monorepo sub-directory; only objects carry one, plain-string entries don't. */
  const directory = isStringForm ? undefined : repoField.directory;

  if (rawString === '') return null;

  /** Match result for the `github:owner/repo` shorthand syntax; preferred over the URL form when present. */
  const shortMatch = /^github:([^/]+)\/(.+?)(?:\.git)?$/i.exec(rawString,);
  if (shortMatch !== null) {
    /** `[full, owner, repo]` captured groups from `shortMatch`; full match discarded. */
    const [, owner, repo,] = shortMatch;
    if ((owner === undefined) || (repo === undefined)) return null;
    return {
      host: 'github',
      owner,
      repo,
      directory,
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  /**
   * Pattern matching any GitHub URL variant: `https://`, `git+`, `git@`, with or without `.git` suffix.
   */
  const githubUrlPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:[/?#].*)?$/i;
  /** Match result for the GitHub URL pattern; `null` when the URL is not on GitHub. */
  const match = githubUrlPattern.exec(rawString,);
  if (match !== null) {
    /** `[full, owner, repo]` captured groups from `match`; full match discarded. */
    const [, owner, repo,] = match;
    if ((owner === undefined) || (repo === undefined)) return null;
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
 *
 * @param pkg - Package-level npm registry response.
 *
 * @returns Concrete version string, or `undefined` if neither pin nor latest resolves.
 *
 * @example
 * ```ts
 * resolveVersion({ range: '10.26.0', pkg }); // '10.26.0' when present in pkg.versions
 * resolveVersion({ range: '^10.0.0', pkg }); // falls back to pkg['dist-tags'].latest
 * ```
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
  if (/^\d+\.\d+\.\d+/.test(range,) && (pkg.versions?.[range] !== undefined)) return range;
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
 *
 * @example
 * ```ts
 * classifyLicense('MIT'); // 'permissive'
 * classifyLicense('GPL-3.0'); // 'copyleft'
 * classifyLicense({ type: 'UNLICENSED' }); // 'non-oss'
 * classifyLicense(undefined); // 'unknown'
 * ```
 */
export function classifyLicense(license: NpmVersion['license'],): LicenseClass {
  /** `true` when the `license` field is a plain SPDX string (vs the `{type: ...}` object form). */
  const isStringForm = (typeof license) === 'string';
  /** Raw license string before normalisation; either the field itself or its `.type` subfield. */
  const unnormalised = isStringForm ? license : (license?.type ?? '');
  /** Normalised license string: object form unwrapped, uppercased, trimmed, ready for set/prefix checks. */
  const raw = unnormalised.toUpperCase().trim();
  if (raw === '') return 'unknown';
  if (PERMISSIVE_LICENSES.has(raw,)) return 'permissive';
  if (raw.startsWith('GPL',) || raw.startsWith('LGPL',) || raw.startsWith('AGPL',) || raw.includes('COPYLEFT',))
    return 'copyleft';
  if ((raw === 'UNLICENSED') || raw.startsWith('SEE LICENSE',) || raw.startsWith('PROPRIETARY',))
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
  /** HTTP response from `fetch`; aborted if it doesn't complete within `HTTP_TIMEOUT_MS`. */
  const response = await fetch(
    url,
    {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS,),
    },
  );
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
  /** `gh api` subprocess result; `stdout` holds the JSON payload, throws on non-zero exit. */
  const result = await spawn(
    'gh',
    [
      'api',
      path,
    ],
    {
      timeout: HTTP_TIMEOUT_MS,
    },
  );
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns `any`; caller asserts T.
  return JSON.parse(result.stdout,) as T;
}

//endregion HTTP helpers

//region Field probes

/**
 * Fetches the package-level npm registry manifest (all versions + time).
 *
 * @param npmName - Real npm package name.
 *
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
  /**
   * Cached manifest, valid for {@link TTL_MS}; `undefined` on cache miss.
   */
  const cached = await cache.read<NpmPackage>({
    name: npmName,
    version: '_pkg',
    field: 'registry',
    ttlMs: TTL_MS,
  },);
  if (cached !== undefined) return cached;
  /**
   * Percent-encoded npm name preserving `@` for scoped packages (so `@scope/name` becomes `@scope%2Fname` not `%40scope%2Fname`).
   */
  const encodedName = encodeURIComponent(npmName,).replaceAll(
    '%40',
    '@',
  );
  /** Fresh manifest from the npm registry; written to cache below before return. */
  const fetched = await fetchJson<NpmPackage>(
    `https://registry.npmjs.org/${encodedName}`,
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
 *
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
  /** Cached downloads payload from a prior run, if still within TTL. */
  const cached = await cache.read<{ downloads: number; }>({
    name: npmName,
    version: '_pkg',
    field: 'downloads',
    ttlMs: TTL_MS,
  },);
  if (cached !== undefined) return cached.downloads;
  try {
    /**
     * Percent-encoded npm name preserving `@` for scoped packages so the URL matches the npm API's expected shape.
     */
    const encodedName = encodeURIComponent(npmName,).replaceAll(
      '%40',
      '@',
    );
    /** Fresh downloads payload from npm; the outer try swallows failures so transient errors yield `0`. */
    const fetched = await fetchJson<{ downloads: number; }>(
      `https://api.npmjs.org/downloads/point/last-week/${encodedName}`,
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
 *
 * @param repo - GitHub repo name.
 *
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
  /** Cache key for the languages probe; `<owner>/<repo>` so different repos don't collide. */
  const key = `${owner}/${repo}`;
  /** Cached Linguist response if previously fetched. */
  const cached = await cache.read<Record<string, number>>({
    name: key,
    version: '_repo',
    field: 'languages',
    ttlMs: TTL_FOREVER,
  },);
  if (cached !== undefined) return cached;
  try {
    /** Fresh Linguist response; on error the catch returns `null` to signal "unknown" upstream. */
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
 *
 * @param repo - GitHub repo name.
 *
 * @param directory - Subdirectory for monorepo-housed packages; whole-repo if omitted.
 *
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
  /** Cache key shared by both whole-repo and path-scoped variants; the `field` discriminates. */
  const key = `${owner}/${repo}`;
  /** Cache field tag; distinguishes whole-repo `pushed_at` from per-directory commit lookups. */
  const field = directory === undefined ? 'pushed_at' : `commits:${directory}`;
  /** Cached ISO date string from a prior probe of the same `key`/`field`. */
  const cached = await cache.read<string>({
    name: key,
    version: '_repo',
    field,
    ttlMs: TTL_MS,
  },);
  if (cached !== undefined) return cached;

  try {
    if (directory === undefined) {
      /** Whole-repo metadata; `pushed_at` is the cheap proxy for "any commit anywhere". */
      const repoMeta = await ghApi<{ pushed_at: string; }>(`repos/${owner}/${repo}`,);
      await cache.write({
        name: key,
        version: '_repo',
        field,
        value: repoMeta.pushed_at,
      },);
      return repoMeta.pushed_at;
    }
    /** Path-scoped commit list (most-recent first); only the first entry's author date is consumed. */
    const commits = await ghApi<readonly { commit?: { author?: { date?: string; }; }; }[]>(
      `repos/${owner}/${repo}/commits?path=${encodeURIComponent(directory,)}&per_page=1`,
    );
    /** Author date of the most-recent path-scoped commit; `undefined` when the response is shaped unexpectedly. */
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
