/**
 Startup recovery across per-transaction directories on disposable real-Git repositories.

 @module
 */
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  join,
} from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  abandonTransaction,
  createRecoveryRepository,
  exitedProcessIdentity,
  headOid,
  journalTransaction,
  landTransaction,
  openTransaction,
  REAL_GIT,
  reassignOwner,
  registryEntries,
  rewriteJsonRecord,
  runFixtureGit,
  stageFile,
} from './commit-transaction-recovery-fixture.unit.test.ts';

const {
  CommitTransactionRecoveryError,
  recordRefUpdated,
  recoverCommitTransaction,
} = internalTestExports;

/**
 Fixed creation times ordering dead transactions deterministically.
 */
const CREATED = [
  '2026-01-01T00:00:01.000Z',
  '2026-01-01T00:00:02.000Z',
  '2026-01-01T00:00:03.000Z',
] as const;

/**
 Runs startup recovery for a repository the way the wrapper does before `git status`.

 @param repository - repository root

 @returns recovery actions in order
 */
async function recoverActions(repository: string,): Promise<readonly string[]> {
  /**
   Recovery outcomes for every examined directory.
   */
  const outcomes = await recoverCommitTransaction({
    args: ['-C', repository, 'status',],
    gitPath: REAL_GIT,
  },);
  return outcomes.map(function actionOf({ action, },): string {
    return action;
  },);
}

/**
 Captures recovery failure text.

 @param repository - repository root

 @returns error message of the expected recovery failure
 */
async function recoveryFailure(repository: string,): Promise<string> {
  try {
    await recoverCommitTransaction({
      args: ['-C', repository, 'status',],
      gitPath: REAL_GIT,
    },);
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
 */
async function exists(path: string,): Promise<boolean> {
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

await describe({
  name: recoverCommitTransaction.name,
  children: [
    //region Several transactions

    it({
      name: 'recovers an unjournaled, a landed, and a prepared dead transaction in one startup, oldest first',
      fn: async function testSeveralDeadTransactions(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'first.txt', content: 'first\n', },);
        /** Oldest transaction, crashed before journaling; its lock was later removed by hand. */
        const unjournaled = await openTransaction(repository.path,);
        await abandonTransaction(unjournaled,);
        await rm(repository.lockPath,);
        /** Landed transaction whose index was installed before the crash. */
        const landed = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: landed, },);
        /** Commit the landed transaction created. */
        const landedOid = await landTransaction({ repository: repository.path, workspace: landed, message: 'landed', },);
        await landed.installIndex(landed.postIndexPath,);
        await abandonTransaction(landed,);
        /** Newest transaction, prepared on top of the landed one and still holding the index lock. */
        const prepared = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: prepared, },);
        await abandonTransaction(prepared,);
        /** Index bytes every later transaction was prepared against. */
        const indexBefore = await readFile(repository.indexPath,);
        await reassignOwner({ directory: unjournaled.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await reassignOwner({ directory: landed.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[1], },);
        await reassignOwner({ directory: prepared.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[2], },);

        expect(await recoverActions(repository.path,),).toEqual([
          'commit-not-created',
          'index-installed',
          'commit-not-created',
        ],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([],);
        expect(await exists(repository.lockPath,),).toBe(false,);
        expect(await headOid(repository.path,),).toBe(landedOid,);
        expect(await readFile(repository.indexPath,),).toEqual(indexBefore,);
      },
    },),
    it({
      name: 'skips a live owner while recovering a dead one beside it',
      fn: async function testLiveOwnerSkipped(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'live.txt', content: 'live\n', },);
        /** Dead prepared transaction whose lock was removed after it crashed. */
        const dead = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: dead, },);
        await abandonTransaction(dead,);
        await rm(repository.lockPath,);
        await reassignOwner({ directory: dead.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        /** Transaction owned by this still-running test process. */
        await using live = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: live, },);

        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created', 'owner-active',],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([live.transactionId,],);
        expect(await exists(repository.lockPath,),).toBe(true,);
      },
    },),
    it({
      name: 'recovers an unlanded transaction whose lock was already removed',
      fn: async function testLockAlreadyRemoved(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'unlocked.txt', content: 'unlocked\n', },);
        /** Prepared transaction whose lock someone removed after the crash. */
        const unlocked = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: unlocked, },);
        await abandonTransaction(unlocked,);
        await rm(repository.lockPath,);
        await reassignOwner({ directory: unlocked.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);

        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created',],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([],);
        expect(await exists(repository.lockPath,),).toBe(false,);
      },
    },),
    it({
      name: 'treats an owner PID that now names another process as dead',
      fn: async function testReusedPid(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'reused.txt', content: 'reused\n', },);
        /** Transaction whose recorded PID is reused by this test process. */
        const reused = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: reused, },);
        await abandonTransaction(reused,);
        await reassignOwner({
          directory: reused.directory,
          owner: { ownerPid: process.pid, ownerIdentity: 'linux:0', },
          createdAt: CREATED[0],
        },);

        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created',],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([],);
        expect(await exists(repository.lockPath,),).toBe(false,);
      },
    },),

    //endregion Several transactions

    //region Reflog nonce

    it({
      name: 'finds the transaction nonce below a later same-commit reflog entry',
      fn: async function testNonceBelowNewest(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'deep.txt', content: 'deep\n', },);
        /** Landed transaction interrupted before installing its index. */
        const landed = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: landed, },);
        /** Commit the transaction created. */
        const landedOid = await landTransaction({ repository: repository.path, workspace: landed, message: 'deep', },);
        /** Prepared index recovery must install. */
        const postIndex = await readFile(landed.postIndexPath,);
        await abandonTransaction(landed,);
        await reassignOwner({ directory: landed.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await runFixtureGit({
          repository: repository.path,
          args: ['update-ref', '-m', 'external same-commit movement', 'HEAD', landedOid, landedOid,],
        },);

        expect(await recoverActions(repository.path,),).toEqual(['index-installed',],);
        expect(await readFile(repository.indexPath,),).toEqual(postIndex,);
        expect(await exists(repository.lockPath,),).toBe(false,);
        expect(await registryEntries(repository.registryRoot,),).toEqual([],);
      },
    },),
    it({
      name: 'uses the durable landed marker without consulting the reflog',
      fn: async function testLandedMarker(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'marker.txt', content: 'marker\n', },);
        /** Landed transaction that recorded its ref update. */
        const landed = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: landed, },);
        await recordRefUpdated({
          workspace: landed,
          landedOid: await landTransaction({ repository: repository.path, workspace: landed, message: 'marker', },),
        },);
        await abandonTransaction(landed,);
        await reassignOwner({ directory: landed.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await runFixtureGit({ repository: repository.path, args: ['reflog', 'expire', '--expire=all', '--all',], },);

        expect(await recoverActions(repository.path,),).toEqual(['index-installed',],);
      },
    },),
    it({
      name: 'fails closed and retains evidence when the reflog lacks the transaction nonce',
      fn: async function testNonceMissing(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'missing.txt', content: 'missing\n', },);
        /** Landed transaction whose reflog entry is deleted. */
        const landed = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: landed, },);
        await landTransaction({ repository: repository.path, workspace: landed, message: 'missing', },);
        await abandonTransaction(landed,);
        await reassignOwner({ directory: landed.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await runFixtureGit({ repository: repository.path, args: ['reflog', 'delete', 'HEAD@{0}',], },);

        expect(await recoveryFailure(repository.path,),).toContain('HEAD reflog does not identify prepared transaction',);
        expect(await exists(landed.directory,),).toBe(true,);
        expect(await exists(repository.lockPath,),).toBe(true,);
      },
    },),
    it({
      name: 'fails closed when HEAD moved past the landed commit before its index was installed',
      fn: async function testHeadMovedPastLanded(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'moved.txt', content: 'moved\n', },);
        /** Landed transaction followed by a ref-only movement. */
        const landed = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: landed, },);
        /** Commit the transaction created. */
        const landedOid = await landTransaction({ repository: repository.path, workspace: landed, message: 'moved', },);
        await abandonTransaction(landed,);
        await reassignOwner({ directory: landed.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        /** Child commit written without touching the index. */
        const laterOid = await runFixtureGit({
          repository: repository.path,
          args: ['commit-tree', `${landedOid}^{tree}`, '-p', landedOid, '-m', 'later',],
        },);
        await runFixtureGit({ repository: repository.path, args: ['update-ref', '-m', 'later', 'HEAD', laterOid,], },);

        expect(await recoveryFailure(repository.path,),).toContain(`differs from transaction landed commit ${landedOid}`,);
        expect(await exists(landed.directory,),).toBe(true,);
      },
    },),

    //endregion Reflog nonce

    //region Registry entries

    it({
      name: 'releases the lock of a dead owner that crashed before publishing its directory',
      fn: async function testDeadStaging(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Transaction whose directory is moved back to its staging name. */
        const staged = await openTransaction(repository.path,);
        await abandonTransaction(staged,);
        await reassignOwner({ directory: staged.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await rename(staged.directory, `${staged.directory}.pending`,);

        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created',],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([],);
        expect(await exists(repository.lockPath,),).toBe(false,);
      },
    },),
    it({
      name: 'skips a live staging candidate and one without a complete owner record',
      fn: async function testUnattributedStaging(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Live transaction moved back to its staging name. */
        await using live = await openTransaction(repository.path,);
        await rename(live.directory, `${live.directory}.pending`,);
        /** Staging candidate whose owner record was torn by a crash. */
        const torn = join(repository.registryRoot, 'a0000000-0000-4000-8000-000000000000.pending',);
        await mkdir(torn,);
        await writeFile(join(torn, 'owner.json',), '{"schemaVersion":2,',);
        /** Staging candidate that crashed before writing its owner record. */
        const empty = join(repository.registryRoot, 'b0000000-0000-4000-8000-000000000000.pending',);
        await mkdir(empty,);

        expect((await recoverActions(repository.path,)).toSorted(),).toEqual([
          'owner-active',
          'staging-unattributed',
          'staging-unattributed',
        ],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([
          `${live.transactionId}.pending`,
          basename(torn,),
          basename(empty,),
        ].toSorted(),);
        await rename(`${live.directory}.pending`, live.directory,);
      },
    },),
    it({
      name: 'removes a retired directory whose removal was interrupted',
      fn: async function testRetired(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Retired leftover. */
        const retired = join(repository.registryRoot, 'c0000000-0000-4000-8000-000000000000.retired',);
        await mkdir(retired, { recursive: true, },);
        await writeFile(join(retired, 'journal.json',), '{}\n',);

        expect(await recoverActions(repository.path,),).toEqual(['retired-removed',],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([],);
      },
    },),
    it({
      name: 'fails closed on a published directory without an owner record',
      fn: async function testMissingOwner(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Published directory holding no owner record. */
        const orphan = join(repository.registryRoot, 'd0000000-0000-4000-8000-000000000000',);
        await mkdir(orphan, { recursive: true, },);
        await writeFile(join(orphan, 'commit.index',), 'x',);

        expect(await recoveryFailure(repository.path,),).toContain(`Transaction owner record is missing: ${orphan}`,);
        expect(await exists(orphan,),).toBe(true,);
      },
    },),
    it({
      name: 'fails closed on an owner record naming another transaction',
      fn: async function testForeignOwnerRecord(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Transaction whose owner record is rewritten to another ID. */
        const moved = await openTransaction(repository.path,);
        await abandonTransaction(moved,);
        await rewriteJsonRecord({
          path: join(moved.directory, 'owner.json',),
          fields: { transactionId: 'e0000000-0000-4000-8000-000000000000', },
        },);

        expect(await recoveryFailure(repository.path,),).toContain('names another transaction',);
      },
    },),
    it({
      name: 'fails closed on a journal whose owner differs from the owner record',
      fn: async function testJournalOwnerMismatch(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'mismatch.txt', content: 'mismatch\n', },);
        /** Journaled transaction whose journal names another owner. */
        const mismatched = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: mismatched, },);
        await abandonTransaction(mismatched,);
        await reassignOwner({ directory: mismatched.directory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await rewriteJsonRecord({
          path: join(mismatched.directory, 'journal.json',),
          fields: { ownerIdentity: 'linux:1', },
        },);

        expect(await recoveryFailure(repository.path,),).toContain('conflicts with its owner record',);
        expect(await exists(mismatched.directory,),).toBe(true,);
      },
    },),

    //endregion Registry entries

    //region Legacy journal

    it({
      name: 'still recovers a legacy single-journal directory and skips its live owner',
      fn: async function testLegacyJournal(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'legacy.txt', content: 'legacy\n', },);
        /** Journaled transaction moved to the legacy location. */
        const legacy = await openTransaction(repository.path,);
        await journalTransaction({ repository: repository.path, workspace: legacy, },);
        await abandonTransaction(legacy,);
        await rename(legacy.directory, repository.legacyDirectory,);

        expect(await recoverActions(repository.path,),).toEqual(['owner-active',],);
        await reassignOwner({ directory: repository.legacyDirectory, owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created',],);
        expect(await exists(repository.legacyDirectory,),).toBe(false,);
        expect(await exists(repository.lockPath,),).toBe(false,);
      },
    },),

    //endregion Legacy journal
  ],
},);
