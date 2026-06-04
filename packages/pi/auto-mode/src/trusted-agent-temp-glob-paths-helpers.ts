/**
 * Helper functions for trusted agent temp glob path allowances.
 *
 * @module
 */

import { realpathSync, } from 'node:fs';
import * as nodePath from 'node:path';

import { SECRET_PATH_PATTERN, } from './constants.ts';
import { isUnder, } from './path-signals.ts';

//region Sentinels

/**
 * Sentinel for paths whose canonical filesystem target cannot be resolved.
 */
const REALPATH_UNAVAILABLE: unique symbol = Symbol('realpath-unavailable',);

/**
 * Result from attempting filesystem canonicalisation.
 */
type RealpathResult = string | typeof REALPATH_UNAVAILABLE;

//endregion Sentinels

//region Glob syntax

/**
 * Check whether path uses supported shell glob metacharacters.
 *
 * Bracket expressions are deliberately unsupported here because they can hide
 * secret-looking literals from text checks without a shell parser.
 *
 * @param filePath - shell path token
 *
 * @returns whether path contains `*` or `?` and no bracket glob
 *
 * @example
 * ```typescript
 * hasSupportedShellGlobSyntax('/tmp/agent/page-*.png'); // true
 * hasSupportedShellGlobSyntax('/tmp/agent/[.]env*'); // false
 * ```
 */
function hasSupportedShellGlobSyntax(
  filePath: string,
): boolean {
  /**
   * Whether path uses simple supported shell glob marks.
   */
  const hasSimpleGlobMark = filePath.includes('*',) || filePath.includes('?',);
  /**
   * Whether path uses bracket glob syntax, which this helper rejects.
   */
  const hasBracketGlobMark = filePath.includes('[',) || filePath.includes(']',);
  if (!hasSimpleGlobMark)
    return false;
  return !hasBracketGlobMark;
}

/**
 * Return existing parent directory before first glob metacharacter.
 *
 * @param resolved - absolute shell path token with supported glob syntax
 *
 * @returns literal parent path to canonicalise
 *
 * @example
 * ```typescript
 * globParentDirectory('/tmp/agent/page-*.png'); // '/tmp/agent'
 * ```
 */
function globParentDirectory(
  resolved: string,
): string {
  /**
   * Literal prefix before shell expands `*` or `?`.
   */
  const prefix = resolved.slice(
    0,
    firstSupportedGlobIndex(resolved,),
  );
  if (prefix.endsWith(nodePath.sep,))
    return prefix === nodePath.sep ? prefix : prefix.slice(
      0,
      -1,
    );
  return nodePath.dirname(prefix,);
}

/**
 * Find first supported shell glob metacharacter.
 *
 * @param filePath - shell path token with supported glob syntax
 *
 * @returns index of first `*` or `?`
 *
 * @example
 * ```typescript
 * firstSupportedGlobIndex('/tmp/a-?.txt'); // 7
 * ```
 */
function firstSupportedGlobIndex(
  filePath: string,
): number {
  /**
   * Indexes for supported glob metacharacters, excluding absent markers.
   */
  const indexes = [
    filePath.indexOf('*',),
    filePath.indexOf('?',),
  ].filter(function markerExists(index,) {
    return index >= 0;
  },);
  return indexes.reduce(function smallerIndex(
    left,
    right,
  ) {
    return Math.min(
      left,
      right,
    );
  },);
}

//endregion Glob syntax

//region Secret path checks

/**
 * Check raw and resolved path text for secret-looking markers.
 *
 * Glob metacharacters are stripped for a second pass so `.env*` still matches
 * the existing secret path pattern.
 *
 * @param filePath - original shell path token
 *
 * @param resolved - lexical absolute path after cwd or home expansion
 *
 * @returns whether any spelling exposes secret-related path markers
 *
 * @example
 * ```typescript
 * pathTextHasSecretMarker({ filePath: '/tmp/agent/.env*', resolved: '/tmp/agent/.env*' }); // true
 * ```
 */
function pathTextHasSecretMarker(
  {
    filePath,
    resolved,
  }: {
    readonly filePath: string;
    readonly resolved: string;
  },
): boolean {
  /**
   * Candidate path spellings, including versions with glob marks removed.
   */
  const candidates = [
    filePath,
    resolved,
  ].flatMap(function pathAndDeGlobbed(path,) {
    return [
      path,
      path.replaceAll(
        '*',
        '',
      )
        .replaceAll(
          '?',
          '',
        ),
    ];
  },);
  return candidates.some(function candidateHasSecretMarker(candidate,) {
    return SECRET_PATH_PATTERN.test(candidate,);
  },);
}

//endregion Secret path checks

//region Canonical containment

/**
 * Check whether canonical path is inside trusted directory.
 *
 * @param canonicalPath - canonical path to test
 *
 * @param cwd - working directory used to resolve relative trusted roots
 *
 * @param trustedDir - trusted temp root
 *
 * @returns whether canonical path stays within canonical trusted root
 *
 * @example
 * ```typescript
 * trustedDirContainsCanonicalPath({ canonicalPath: '/tmp/agent', cwd: '/repo', trustedDir: '/tmp/agent' });
 * ```
 */
function trustedDirContainsCanonicalPath(
  {
    canonicalPath,
    cwd,
    trustedDir,
  }: {
    readonly canonicalPath: string;
    readonly cwd: string;
    readonly trustedDir: string;
  },
): boolean {
  /**
   * Canonical trusted root used to block symlink escapes.
   */
  const canonicalTrustedDir = realpathOrUnavailable(nodePath.resolve(
    cwd,
    trustedDir,
  ),);
  return (canonicalTrustedDir !== REALPATH_UNAVAILABLE)
    && isUnder({
      resolved: canonicalPath,
      dir: canonicalTrustedDir,
    },);
}

/**
 * Resolve filesystem path to canonical target without throwing.
 *
 * @param path - filesystem path to canonicalise
 *
 * @returns canonical path or sentinel when missing or inaccessible
 *
 * @example
 * ```typescript
 * realpathOrUnavailable('/tmp/agent');
 * ```
 */
function realpathOrUnavailable(
  path: string,
): RealpathResult {
  try {
    return realpathSync.native(path,);
  }
  catch {
    return REALPATH_UNAVAILABLE;
  }
}

//endregion Canonical containment

export {
  globParentDirectory,
  hasSupportedShellGlobSyntax,
  pathTextHasSecretMarker,
  realpathOrUnavailable,
  REALPATH_UNAVAILABLE,
  trustedDirContainsCanonicalPath,
};
