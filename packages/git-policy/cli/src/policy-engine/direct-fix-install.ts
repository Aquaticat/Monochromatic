/**
 * Atomic direct-fix worktree installation.
 *
 * @module
 */
import { randomUUID, } from 'node:crypto';
import {
  copyFile,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { CandidateFile, } from '../api/policy-types.ts';
import type { AddPolicyFactsScope, } from './add-policy-facts.ts';

/**
 * Module logger.
 */
const l = tagged({ tag: 'cli-git', },);
/**
 * Ordinary file mode.
 */
const REGULAR_MODE = 0o644;
/**
 * Executable file mode.
 */
const EXECUTABLE_MODE = 0o755;
/**
 * Real index absence sentinel.
 */
const INDEX_ABSENT: unique symbol = Symbol('real index file absent',);

/**
 * Initial direct-fix worktree bytes by repository path.
 */
export type DirectFixOriginalBytes = ReadonlyMap<string, Uint8Array>;

/**
 * Prepared atomic worktree replacement.
 */
type PreparedReplacement = Readonly<{
  /**
   * Repository-relative path.
   */
  path: string;
  /**
   * Absolute destination path.
   */
  destination: string;
  /**
   * Same-directory replacement path.
   */
  prepared: string;
  /**
   * Same-directory rollback copy.
   */
  backup: string;
}>;

/**
 * Compares exact byte arrays.
 *
 * @param left - first byte sequence
 *
 * @param right - second byte sequence
 *
 * @returns whether bytes are identical
 */
function bytesEqual({
  left,
  right,
}: Readonly<{
  left: Uint8Array;
  right: Uint8Array;
}>,): boolean {
  if (left.length !== right.length)
    return false;
  return left.every(function sameByte(
    byte,
    index,
  ) {
    return byte === right[index];
  },);
}

/**
 * Reads optional real index bytes.
 *
 * @param path - absolute real index path
 *
 * @returns exact bytes or absence sentinel
 */
async function readIndex(path: string,): Promise<Uint8Array | typeof INDEX_ABSENT> {
  try {
    return await readFile(path,);
  }
  catch (error: unknown) {
    l.debug(`real index snapshot read failed for ${path}: ${String(error,)}`,);
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return INDEX_ABSENT;
    throw error;
  }
}

/**
 * Tests exact optional index equality.
 *
 * @param left - first index snapshot
 *
 * @param right - second index snapshot
 *
 * @returns whether both are absent or byte-identical
 */
function indexesEqual({
  left,
  right,
}: Readonly<{
  left: Uint8Array | typeof INDEX_ABSENT;
  right: Uint8Array | typeof INDEX_ABSENT;
}>,): boolean {
  if (((typeof left) === 'symbol') || ((typeof right) === 'symbol'))
    return left === right;
  return bytesEqual({
    left,
    right,
  });
}

/**
 * Removes prepared and backup files after success or rollback.
 *
 * @param replacements - prepared replacement records
 */
async function cleanup(replacements: readonly PreparedReplacement[],): Promise<void> {
  await Promise.all(replacements.flatMap(function cleanupPaths(replacement,) {
    return [
      rm(
        replacement.prepared,
        { force: true, },
      ),
      rm(
        replacement.backup,
        { force: true, },
      ),
    ];
  },),);
}

/**
 * Rolls installed paths back from same-directory copies.
 *
 * @param installed - replacements already installed
 */
async function rollback(installed: readonly PreparedReplacement[],): Promise<void> {
  for (const replacement of installed.toReversed()) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Rollback order is intentionally reverse installation order.
      await rename(
        replacement.backup,
        replacement.destination,
      );
    }
    catch (error: unknown) {
      l.error(`direct-fix rollback failed for ${replacement.path}: ${String(error,)}`,);
      throw error;
    }
  }
}

/**
 * Captures exact selected worktree bytes before convergence.
 *
 * @param candidates - initial direct-fix candidates
 *
 * @returns path-to-byte snapshot for ordinary content
 *
 * @example
 * ```ts
 * await captureDirectFixOriginalBytes([]);
 * ```
 */
export async function captureDirectFixOriginalBytes(
  candidates: readonly CandidateFile[],
): Promise<DirectFixOriginalBytes> {
  /**
   * Captured ordinary candidate entries.
   */
  const entries: (readonly [
    string,
    Uint8Array
  ])[] = [];
  /* oxlint-disable no-await-in-loop -- Sequential candidate reads bound process-backed fact loading. */
  for (const candidate of candidates) {
    if ((candidate.change !== 'deleted')
      && ((candidate.mode === 'regular') || (candidate.mode === 'executable')))
      entries.push([
        candidate.path,
        await candidate.bytes(),
      ],);
  }
  /* oxlint-enable no-await-in-loop */
  return new Map(entries,);
}

/**
 * Installs converged private-index bytes without changing real index.
 *
 * @param scope - direct-fix private state
 *
 * @param changedPaths - paths changed by converged policy patches
 *
 * @param originals - exact pre-convergence worktree bytes
 *
 * @throws Error when worktree or index changed concurrently
 *
 * @example
 * ```ts
 * await installDirectFix({ scope, changedPaths: [], originals: new Map() });
 * ```
 */
export async function installDirectFix({
  scope,
  changedPaths,
  originals,
}: Readonly<{
  scope: AddPolicyFactsScope;
  changedPaths: readonly string[];
  originals: DirectFixOriginalBytes;
}>,): Promise<void> {
  /**
   * Real index snapshot proving direct fix remains index-neutral.
   */
  const indexBefore = await readIndex(scope.realIndexPath,);
  /**
   * Final private candidates containing converged bytes.
   */
  const finalCandidates = await scope.gitFacts
    .candidates();
  /**
   * Prepared replacement records.
   */
  const replacements: PreparedReplacement[] = [];
  /* oxlint-disable no-await-in-loop -- Preparation is sequential to bound filesystem descriptors and preserve deterministic rollback records. */
  for (const path of changedPaths) {
    /**
     * Final candidate for changed path.
     */
    const candidate = finalCandidates.find(function candidateAtPath(value,) {
      return value.path === path;
    },);
    /**
     * Initial expected worktree bytes.
     */
    const original = originals.get(path,);
    if ((candidate === undefined) || (original === undefined)
      || ((candidate.mode !== 'regular') && (candidate.mode !== 'executable')))
      throw new Error(`Direct-fix candidate became unavailable: ${path}`,);
    /**
     * Absolute worktree destination.
     */
    const destination = join(
      scope.repositoryRoot,
      path,
    );
    /**
     * Current bytes immediately before replacement preparation.
     */
    const current = await readFile(destination,);
    if (!bytesEqual({
      left: current,
      right: original,
    }))
      throw new Error(`Direct-fix worktree path changed concurrently: ${path}`,);
    /**
     * Unique sibling prefix retaining destination filesystem.
     */
    const temporaryPrefix = join(
      dirname(destination,),
      `.cli-git-direct-fix-${randomUUID()}`,
    );
    /**
     * Prepared replacement record.
     */
    const replacement: PreparedReplacement = {
      path,
      destination,
      prepared: `${temporaryPrefix}.new`,
      backup: `${temporaryPrefix}.old`,
    };
    await copyFile(
      destination,
      replacement.backup,
    );
    await writeFile(
      replacement.prepared,
      await candidate.bytes(),
      { mode: candidate.mode === 'executable' ? EXECUTABLE_MODE : REGULAR_MODE, },
    );
    replacements.push(replacement,);
  }
  /* oxlint-enable no-await-in-loop */
  /**
   * Replacements already visible in worktree.
   */
  const installed: PreparedReplacement[] = [];
  try {
    /* oxlint-disable no-await-in-loop -- Atomic sibling renames install deterministic path order. */
    for (const replacement of replacements) {
      await rename(
        replacement.prepared,
        replacement.destination,
      );
      installed.push(replacement,);
    }
    /* oxlint-enable no-await-in-loop */
    /**
     * Real index snapshot after worktree-only installation.
     */
    const indexAfter = await readIndex(scope.realIndexPath,);
    if (!indexesEqual({
      left: indexBefore,
      right: indexAfter,
    }))
      throw new Error('Direct fix changed real Git index bytes.',);
  }
  catch (error: unknown) {
    l.error(`direct-fix installation failed: ${String(error,)}`,);
    await rollback(installed,);
    await cleanup(replacements,);
    throw error;
  }
  await cleanup(replacements,);
}
