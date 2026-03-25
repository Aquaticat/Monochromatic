/**
 * Semver parsing and comparison utilities for catalog-tighten.
 *
 * Handles `>=` range extraction and semver comparison
 * for determining when catalog entries can be tightened.
 */

//region Types

/**
 * Parsed `>=` range from a catalog entry.
 *
 * @example `{ prefix: "npm:\@jsr/zod__zod\@", range: ">=4.1.8" }` for `"npm:\@jsr/zod__zod\@>=4.1.8"`
 */
export type ParsedRange = {
  /** Everything before the `>=` token, including any `npm:` alias prefix. Empty string for plain `>=x.y.z`. */
  prefix: string;
  /** Semver version string after `>=`, e.g. `"1.2.3"` or `"7.0.0-dev.20250311"`. */
  version: string;
};

//endregion Types

//region Semver parsing

/** Regex matching a `>=` range, optionally preceded by an npm alias prefix. */
const RANGE_RE = /^(?<prefix>.*?)>=(?<version>.+)$/;

/**
 * Extracts the `>=` version and any alias prefix from a catalog value.
 * Returns `undefined` for values that are not `>=` ranges.
 *
 * @param value - raw catalog entry value, e.g. `">=1.2.3"` or `"npm:@jsr/foo@>=1.0.0"`
 *
 * @returns parsed prefix and version, or `undefined`
 *
 * @example
 * ```ts
 * parseRange(">=1.2.3") // { prefix: "", version: "1.2.3" }
 * parseRange("npm:\@jsr/zod__zod\@>=4.1.8") // { prefix: "npm:\@jsr/zod__zod\@", version: "4.1.8" }
 * parseRange("*") // undefined
 * ```
 */
export function parseRange(value: string,): ParsedRange | undefined {
  const match = RANGE_RE.exec(value,);
  if (match === null)
    return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- regex named groups are guaranteed by RANGE_RE pattern
  const {
    prefix,
    version,
  } = match.groups as {
    prefix: string;
    version: string
  };
  return {
    prefix,
    version,
  };
}

/**
 * Splits a semver string into `[major, minor, patch, prerelease]`.
 * Prerelease is everything after the first `-`, or empty string.
 *
 * @param version - semver string, e.g. `"1.2.3"` or `"7.0.0-dev.20250311"`
 *
 * @returns tuple of `[major, minor, patch, prerelease]`
 *
 * @example
 * ```ts
 * splitSemver("1.2.3") // [1, 2, 3, ""]
 * splitSemver("7.0.0-dev.20250311") // [7, 0, 0, "dev.20250311"]
 * ```
 */
function splitSemver(version: string,): [
  number,
  number,
  number,
  string,
] {
  const dashIndex = version.indexOf('-',);
  const prerelease = dashIndex === -1 ? '' : version.slice(dashIndex + 1,);
  const coreStr = dashIndex === -1 ? version : version.slice(
    0,
    dashIndex,
  );
  const parts = coreStr.split('.',);
  return [
    Number(parts[0],),
    Number(parts[1],),
    Number(parts[2],),
    prerelease,
  ];
}

/**
 * Determines whether `installed` is strictly greater than `cataloged`.
 * Follows semver ordering: major \> minor \> patch \> prerelease (lexicographic).
 * A release version (no prerelease) is greater than any prerelease of the same triple.
 *
 * @param cataloged - version from the catalog range
 *
 * @param installed - version from node_modules
 *
 * @returns `true` if `installed` is strictly newer
 *
 * @example
 * ```ts
 * isStrictlyGreater("1.2.0", "1.3.0") // true
 * isStrictlyGreater("1.2.0", "1.2.0") // false
 * isStrictlyGreater("7.0.0-dev.1", "7.0.0-dev.2") // true
 * ```
 */
export function isStrictlyGreater(
  cataloged: string,
  installed: string,
): boolean {
  const [cMaj, cMin, cPat, cPre,] = splitSemver(cataloged,);
  const [iMaj, iMin, iPat, iPre,] = splitSemver(installed,);

  if (iMaj !== cMaj)
    return iMaj > cMaj;
  if (iMin !== cMin)
    return iMin > cMin;
  if (iPat !== cPat)
    return iPat > cPat;

  // Same major.minor.patch -- compare prerelease
  // No prerelease > any prerelease (release is "greater" than prerelease of same triple)
  if (cPre !== '' && iPre === '')
    return true;
  if (cPre === '' && iPre !== '') {
    // Installed is a prerelease of the same triple -- not greater
    return false;
  }
  // Both have prerelease or both have none
  return iPre > cPre;
}

//endregion Semver parsing
