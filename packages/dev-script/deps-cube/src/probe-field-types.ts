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
  readonly 'dist-tags'?: { readonly latest?: string; };
  readonly time?: { readonly created?: string; };
  readonly versions?: Readonly<Record<string, NpmVersion>>;
};

/**
 * Subset of one version's manifest.
 */
export type NpmVersion = {
  readonly repository?:
    | string
    | {
      readonly type?: string;
      readonly url?: string;
      readonly directory?: string;
    };
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly dist?: { readonly unpackedSize?: number; };
  readonly license?: string | { readonly type?: string; };
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
