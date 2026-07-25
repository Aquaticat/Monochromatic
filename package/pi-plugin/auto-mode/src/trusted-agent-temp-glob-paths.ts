/**
 * Trusted agent temp shell-glob path allowances.
 *
 * `unbash` preserves absolute glob words as command arguments. Trusted helper
 * commands may legitimately receive a not-yet-existing glob under their private
 * temp root, but that allowance must stay lexical-parent and secret-name safe.
 *
 * @module
 */

import { resolvePath, } from './path-signals.ts';
import { isExistingNonSecretTrustedAgentTempPath, } from './trusted-agent-temp-paths.ts';
import {
  globParentDirectory,
  hasSupportedShellGlobSyntax,
  pathTextHasSecretMarker,
  realpathOrUnavailable,
  REALPATH_UNAVAILABLE,
  trustedDirContainsCanonicalPath,
} from './trusted-agent-temp-glob-paths-helpers.ts';
import type { SignalContext, } from './types.ts';

//region Public API

/**
 * Check whether path is safe as trusted temp helper input.
 *
 * Existing files use canonical target checks via
 * {@link isExistingNonSecretTrustedAgentTempPath}. Shell glob paths fall
 * through to {@link isNonSecretTrustedAgentTempGlobPath}, which allows them
 * only when their literal parent already canonicalises under a trusted temp
 * root and their text does not contain secret-looking path markers.
 *
 * @param filePath - shell path token
 *
 * @param ctx - path resolution context
 *
 * @param trustedAgentTempDirs - private agent temp roots trusted for helpers
 *
 * @returns whether path may be ignored as trusted helper input
 *
 * @example
 * ```typescript
 * isNonSecretTrustedAgentTempBashPath({
 *   filePath: '/account-home/temp/agent/page-*.png',
 *   ctx,
 *   trustedAgentTempDirs: ['/account-home/temp/agent'],
 * });
 * ```
 */
async function isNonSecretTrustedAgentTempBashPath(
  {
    filePath,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  if (await isExistingNonSecretTrustedAgentTempPath({
    filePath,
    ctx,
    trustedAgentTempDirs,
  },)) {
    return true;
  }
  return await isNonSecretTrustedAgentTempGlobPath({
    filePath,
    ctx,
    trustedAgentTempDirs,
  },);
}

//endregion Public API

//region Glob paths

/**
 * Check whether missing glob path stays under trusted temp and is non-secret.
 *
 * Requires {@link hasSupportedShellGlobSyntax}, resolves the token with
 * {@link resolvePath}, rejects secret-looking text via
 * {@link pathTextHasSecretMarker}, canonicalises the existing literal parent
 * with {@link realpathOrUnavailable} and {@link globParentDirectory}, then
 * checks containment with {@link trustedDirContainsCanonicalPath}.
 *
 * @param filePath - shell path token that may contain glob syntax
 *
 * @param ctx - path resolution context
 *
 * @param trustedAgentTempDirs - private agent temp roots trusted for helpers
 *
 * @returns whether glob input is safe for trusted helper execution
 *
 * @example
 * ```typescript
 * isNonSecretTrustedAgentTempGlobPath({
 *   filePath: '/account-home/temp/agent/page-*.png',
 *   ctx,
 *   trustedAgentTempDirs,
 * });
 * ```
 */
async function isNonSecretTrustedAgentTempGlobPath(
  {
    filePath,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  if (!hasSupportedShellGlobSyntax(filePath,))
    return false;

  /**
   * Lexically resolved glob path, used only to find existing literal parent.
   */
  const resolved = resolvePath({
    filePath,
    cwd: ctx.cwd,
  },);
  if (pathTextHasSecretMarker({
    filePath,
    resolved,
  },)) {
    return false;
  }

  /**
   * Canonical existing literal parent before first glob metacharacter.
   */
  const canonicalParent = await realpathOrUnavailable(globParentDirectory(resolved,),);
  if (canonicalParent === REALPATH_UNAVAILABLE)
    return false;

  /**
   * Concurrent containment work for every trusted root.
   */
  const containmentPromises: Promise<boolean>[] = [];
  for (const trustedDir of trustedAgentTempDirs) {
    containmentPromises[containmentPromises.length] = trustedDirContainsCanonicalPath({
      canonicalPath: canonicalParent,
      cwd: ctx.cwd,
      trustedDir,
    },);
  }
  /**
   * Trusted-root containment decisions for current canonical glob parent.
   */
  const containmentDecisions = await Promise.all(containmentPromises,);
  for (const containsParent of containmentDecisions) {
    if (containsParent)
      return true;
  }
  return false;
}

//endregion Glob paths

export { isNonSecretTrustedAgentTempBashPath, };
