/**
 * Pure parser helpers for npm package metadata.
 *
 * @example
 * ```ts
 * const repo = parseRepository('github:preactjs/preact');
 * const licenseClass = classifyLicense('MIT');
 * ```
 */

import type {
  LicenseClass,
  NpmPackage,
  NpmVersion,
  RepositoryInfo,
} from './probe-field-types.ts';

//region Constants

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
 * @param repoField - Raw `repository` value from version manifest.
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
  if ((repoField === undefined) || (repoField === null))
    return null;

  /** `true` when `repository` field is a plain string instead of an object. */
  const isStringForm = (typeof repoField) === 'string';
  /** Unified string form of `repository`, regardless of plain-string or object shape. */
  const rawString = isStringForm ? repoField : (repoField.url ?? '');
  /** Optional monorepo sub-directory; only object-form entries carry one. */
  const directory = isStringForm ? undefined : repoField.directory;

  if (rawString === '')
    return null;

  /** Match result for `github:owner/repo` shorthand syntax. */
  const shortMatch = /^github:([^/]+)\/(.+?)(?:\.git)?$/i.exec(rawString,);
  if (shortMatch !== null) {
    /** `[full, owner, repo]` captured groups from `shortMatch`; full match discarded. */
    const [, owner, repo,] = shortMatch;
    if ((owner === undefined) || (repo === undefined))
      return null;
    return {
      host: 'github',
      owner,
      repo,
      directory,
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  /**
   * Pattern matching GitHub URL variants: `https://`, `git+`, `git@`, with optional `.git` suffix.
   */
  const githubUrlPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:[/?#].*)?$/i;
  /** Match result for GitHub URL pattern; `null` when URL is not on GitHub. */
  const match = githubUrlPattern.exec(rawString,);
  if (match !== null) {
    /** `[full, owner, repo]` captured groups from `match`; full match discarded. */
    const [, owner, repo,] = match;
    if ((owner === undefined) || (repo === undefined))
      return null;
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
 * @param range - Range string from catalog.
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
  if (/^\d+\.\d+\.\d+/.test(range,) && (pkg.versions?.[range] !== undefined))
    return range;
  return pkg['dist-tags']?.latest;
}

//endregion Version resolution

//region License classification

/**
 * Reduces SPDX license strings to coarse audit categories.
 *
 * @param license - Raw `license` field from version manifest.
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
  /** `true` when `license` field is a plain SPDX string instead of object form. */
  const isStringForm = (typeof license) === 'string';
  /** Raw license string before normalisation, either field itself or `.type` subfield. */
  const unnormalised = isStringForm ? license : (license?.type ?? '');
  /** Normalised license string, object form unwrapped, uppercased, trimmed, ready for checks. */
  const raw = unnormalised.toUpperCase().trim();
  if (raw === '')
    return 'unknown';
  if (PERMISSIVE_LICENSES.has(raw,))
    return 'permissive';
  if (raw.startsWith('GPL',)
    || raw.startsWith('LGPL',)
    || raw.startsWith('AGPL',)
    || raw.includes('COPYLEFT',))
  {
    return 'copyleft';
  }
  if ((raw === 'UNLICENSED')
    || raw.startsWith('SEE LICENSE',)
    || raw.startsWith('PROPRIETARY',))
  {
    return 'non-oss';
  }
  return 'unknown';
}

//endregion License classification
