/**
 Startup recovery invocation helpers shared by recovery tests.

 @module
 */
import { access, } from 'node:fs/promises';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  type OwnerIdentity,
  REAL_GIT,
} from './commit-transaction-recovery-fixture.unit.test.ts';

const {
  CommitTransactionRecoveryError,
  recoverCommitTransaction,
  resolveProcessBirthIdentity,
} = internalTestExports;

/**
 Fixed creation times ordering dead transactions deterministically.
 */
export const CREATED = [
  '2026-01-01T00:00:01.000Z',
  '2026-01-01T00:00:02.000Z',
  '2026-01-01T00:00:03.000Z',
] as const;

/**
 Runs startup recovery for a repository the way the wrapper does before `git status`.

 @param repository - repository root

 @returns recovery actions in order

 @example
 ```ts
 await recoverActions('/tmp/repo');
 ```
 */
export async function recoverActions(repository: string,): Promise<readonly string[]> {
  /**
   Recovery outcomes for every examined directory.
   */
  const outcomes = await recoverCommitTransaction({ args: ['-C', repository, 'status',], gitPath: REAL_GIT, },);
  return outcomes.map(function actionOf({ action, },): string {
    return action;
  },);
}

/**
 Captures recovery failure text.

 @param repository - repository root

 @returns error message of the expected recovery failure

 @example
 ```ts
 await recoveryFailure('/tmp/repo');
 ```
 */
export async function recoveryFailure(repository: string,): Promise<string> {
  try {
    await recoverCommitTransaction({ args: ['-C', repository, 'status',], gitPath: REAL_GIT, },);
  }
  catch (error: unknown) {
    if (error instanceof CommitTransactionRecoveryError)
      return error.message;
    throw error;
  }
  throw new Error('Recovery unexpectedly succeeded.',);
}

/**
 Reports path presence.

 @param path - exact path

 @returns whether the path exists

 @example
 ```ts
 await exists('/tmp/repo/.git/index.lock');
 ```
 */
export async function exists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 This test process as a live transaction owner.

 @returns PID and birth identity

 @example
 ```ts
 await stopTransaction({ repository, phase: 'prepared', message: 'x', owner: await liveOwner(), createdAt });
 ```
 */
export async function liveOwner(): Promise<OwnerIdentity> {
  /**
   This process's birth identity.
   */
  const ownerIdentity = await resolveProcessBirthIdentity(process.pid,);
  if ((typeof ownerIdentity) === 'symbol')
    throw new Error('Test process identity is unavailable.',);
  return { ownerPid: process.pid, ownerIdentity, };
}
