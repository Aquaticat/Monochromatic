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
 * Existing files use canonical target checks. Shell glob paths are allowed only
 * when their literal parent already canonicalises under a trusted temp root and
 * their text does not contain secret-looking path markers.
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
 * isNonSecretTrustedAgentTempBashPath({ filePath: '/tmp/agent/page-*.png', ctx, trustedAgentTempDirs: ['/tmp/agent'] });
 * ```
 */
function isNonSecretTrustedAgentTempBashPath(
  {
    filePath,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): boolean {
  return isExistingNonSecretTrustedAgentTempPath({
    filePath,
    ctx,
    trustedAgentTempDirs,
  },) || isNonSecretTrustedAgentTempGlobPath({
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
 * isNonSecretTrustedAgentTempGlobPath({ filePath: '/tmp/agent/page-*.png', ctx, trustedAgentTempDirs });
 * ```
 */
function isNonSecretTrustedAgentTempGlobPath(
  {
    filePath,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): boolean {
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
  const canonicalParent = realpathOrUnavailable(globParentDirectory(resolved,),);
  if (canonicalParent === REALPATH_UNAVAILABLE)
    return false;

  return trustedAgentTempDirs.some(
    function trustedDirContainsGlobParent(trustedDir,) {
      return trustedDirContainsCanonicalPath({
        canonicalPath: canonicalParent,
        cwd: ctx.cwd,
        trustedDir,
      },);
    },
  );
}

//endregion Glob paths

export { isNonSecretTrustedAgentTempBashPath, };
