/**
 * Helper functions for trusted agent temp glob path allowances.
 *
 * @module
 */

import { realpath, } from 'node:fs/promises';
import * as nodePath from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { SECRET_PATH_PATTERN, } from './constants.ts';
import { isUnder, } from './path-signals.ts';

//region Logging

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for the trusted-agent-temp-glob-paths-helpers module.
 */
const moduleLogger = tagged({
  tag: 'trusted-agent-temp-glob-paths-helpers',
  l: parentLogger,
},);

//endregion Logging

//region Sentinels

/**
 * Sentinel for paths whose canonical filesystem target cannot be resolved.
 */
const REALPATH_UNAVAILABLE: unique symbol = Symbol('trusted agent temp glob realpath unavailable for path',);

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
 * hasSupportedShellGlobSyntax('/account-home/temp/agent/page-*.png'); // true
 * hasSupportedShellGlobSyntax('/account-home/temp/agent/[.]env*'); // false
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
 * Return existing parent directory before first glob metacharacter, found via
 * {@link firstSupportedGlobIndex}.
 *
 * @param resolved - absolute shell path token with supported glob syntax
 *
 * @returns literal parent path to canonicalise
 *
 * @example
 * ```typescript
 * globParentDirectory('/account-home/temp/agent/page-*.png'); // '/account-home/temp/agent'
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
 * Check raw and resolved path text against {@link SECRET_PATH_PATTERN} for
 * secret-looking markers.
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
 * pathTextHasSecretMarker({
 *   filePath: '/account-home/temp/agent/.env*',
 *   resolved: '/account-home/temp/agent/.env*',
 * }); // true
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
 * Canonicalises the trusted root with {@link realpathOrUnavailable} before
 * comparing containment with {@link isUnder}.
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
 * trustedDirContainsCanonicalPath({
 *   canonicalPath: '/account-home/temp/agent',
 *   cwd: '/repo',
 *   trustedDir: '/account-home/temp/agent',
 * });
 * ```
 */
async function trustedDirContainsCanonicalPath(
  {
    canonicalPath,
    cwd,
    trustedDir,
  }: {
    readonly canonicalPath: string;
    readonly cwd: string;
    readonly trustedDir: string;
  },
): Promise<boolean> {
  /**
   * Canonical trusted root used to block symlink escapes.
   */
  const canonicalTrustedDir = await realpathOrUnavailable(nodePath.resolve(
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
 * realpathOrUnavailable('/account-home/temp/agent');
 * ```
 */
async function realpathOrUnavailable(
  path: string,
): Promise<RealpathResult> {
  try {
    return await realpath(path,);
  }
  catch (error) {
    /**
     * Sub-logger tagged with this function name so the handled realpath failure stays traceable.
     */
    const innerL = tagged({
      tag: realpathOrUnavailable.name,
      l: moduleLogger,
    },);
    innerL.debug(`realpath failed for ${path}: ${String(error,)}`,);
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
