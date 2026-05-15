/**
 * Shared field-probe types used by registry, repository, and parser helpers.
 *
 * @example
 * ```ts
 * import type { NpmPackage, RepositoryInfo } from './probe-field-types.ts';
 * ```
 */

//region Public types

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
