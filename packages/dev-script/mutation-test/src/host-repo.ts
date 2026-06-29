/**
 * Repository-root discovery helpers for host orchestration.
 *
 * @example
 * ```ts
 * await findRepoRoot(process.cwd());
 * ```
 */

import { access, } from 'node:fs/promises';
import {
  join,
  resolve,
  sep,
} from 'node:path';

import { caughtErrorMessage, } from './error-format.ts';

/**
 * Computes ancestor directories from nearest to filesystem root.
 *
 * @param start - Starting directory.
 *
 * @returns Candidate roots to check.
 *
 * @example
 * ```ts
 * ancestorDirectories('/a/b');
 * // ['/a/b', '/a', '/']
 * ```
 */
function ancestorDirectories(start: string,): readonly string[] {
  /**
   * Absolute starting path.
   */
  const absolute = resolve(start,);
  /**
   * Non-empty path segments under root.
   */
  const segments = absolute
    .split(sep,)
    .filter(function notEmpty(segment,): boolean {
      return segment !== '';
    },);

  return Array.from(
    { length: segments.length + 1, },
    function ancestorAtDepth(
      _,
      depth,
    ): string {
      /**
       * Segments retained for current ancestor candidate.
       */
      const retained = segments.slice(
        0,
        segments.length - depth,
      );
      return retained.length === 0 ? sep : `${sep}${retained.join(sep,)}`;
    },
  );
}

/**
 * Checks whether a directory contains the workspace config file.
 *
 * @param candidate - Candidate directory.
 *
 * @returns True when candidate has `pnpm-workspace.yaml`.
 *
 * @example
 * ```ts
 * await hasWorkspaceFile('/repo');
 * ```
 */
async function hasWorkspaceFile(candidate: string,): Promise<boolean> {
  try {
    await access(join(
      candidate,
      'pnpm-workspace.yaml',
    ),);
    return true;
  }
  catch (error) {
    console.warn(
      `[mutation-test] workspace marker probe failed under ${candidate}: ${caughtErrorMessage(error,)}`,
    );
    return false;
  }
}

/**
 * Finds repository root by walking upward to `pnpm-workspace.yaml`.
 *
 * @param start - Starting directory.
 *
 * @returns Absolute repository root.
 *
 * @example
 * ```ts
 * await findRepoRoot(process.cwd());
 * ```
 */
export async function findRepoRoot(start: string,): Promise<string> {
  /**
   * Ancestors checked from nearest to root.
   */
  const candidates = ancestorDirectories(start,);
  /**
   * Workspace-file existence checks for every ancestor.
   */
  const checks = await Promise.all(candidates.map(async function checkCandidate(candidate,): Promise<{
    readonly candidate: string;
    readonly exists: boolean;
  }> {
    return {
      candidate,
      exists: await hasWorkspaceFile(candidate,),
    };
  },),);
  /**
   * Nearest ancestor containing workspace config.
   */
  const match = checks.find(function isWorkspaceRoot(check,): boolean {
    return check.exists;
  },);

  if (match === undefined)
    throw new Error(`Could not find pnpm-workspace.yaml from ${start}`,);

  return match.candidate;
}
