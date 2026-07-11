#!/usr/bin/env node
/**
 * Explicit command boundary for retiring hk Git-config registrations.
 *
 * Invoke only through the root `cleanup:hk-git-config` mise task.
 *
 * @module
 */

import {
  cleanupHkGitConfig,
  type HkConfigScope,
} from './hk-config-cleanup.ts';
import { resolveGit, } from '../resolve-git.ts';

//region Cleanup command -- Require explicit scopes and report exact removed keys.

/**
 * Whether caller explicitly authorized current-repository cleanup.
 */
const cleansLocal = process.env
  .usage_local
  === 'true';
/**
 * Whether caller explicitly authorized per-user global cleanup.
 */
const cleansGlobal = process.env
  .usage_global
  === 'true';
/**
 * Explicit configuration scopes in stable local-before-global order.
 */
const scopes: readonly HkConfigScope[] = [
  ...(cleansLocal ? ['local' as const,] : []),
  ...(cleansGlobal ? ['global' as const,] : []),
];
if (scopes.length === 0)
  throw new TypeError('Choose --local, --global, or both for hk Git-config cleanup.',);

/**
 * Repository boundary, overridable only so disposable verification never touches checkout configuration.
 */
const cleanupCwd = process.env
  .CLI_GIT_HK_CLEANUP_CWD
  ?? process.cwd();
/**
 * Real Git executable selected with cli-git's self-shim rejection.
 */
const gitPath = await resolveGit();
/**
 * Exact cleanup results from independently owned configuration scopes.
 */
const results = await Promise.all(scopes.map(function cleanScope(scope,) {
  return cleanupHkGitConfig({
    gitPath,
    scope,
    cwd: cleanupCwd,
  },);
},),);
console.log(JSON.stringify({
  schemaVersion: 1,
  results,
},),);

//endregion Cleanup command
