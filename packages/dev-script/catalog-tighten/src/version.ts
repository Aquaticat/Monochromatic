/**
 * Barrel re-export for version utilities.
 *
 * Semver parsing lives in `version-parse.ts`;
 * installed-version resolution lives in `version-resolve.ts`.
 */

export {
  isStrictlyGreater,
  type ParsedRange,
  parseRange,
} from './version-parse.ts';
export {
  readInstalledVersion,
  resolveNpmNames,
} from './version-resolve.ts';
