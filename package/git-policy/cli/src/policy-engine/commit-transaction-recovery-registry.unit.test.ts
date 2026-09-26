/**
 Startup recovery of registry entries other than published schema-version-2 transactions:
 staging candidates, retired leftovers, damaged owner records, stale landing locks, unreleased journals, and legacy journals.

 @module
 */
import {
  copyFile,
  lstat,
  mkdir,
  open,
  rename,
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
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  createRecoveryRepository,
  exitedProcessIdentity,
  headOid,
  type OwnerIdentity,
  recoveryLeftovers,
  registryEntries,
  rewriteJsonRecord,
  runFixtureGit,
  stageFile,
} from './commit-transaction-recovery-fixture.unit.test.ts';
import { stopTransaction, } from './commit-transaction-recovery-phase-fixture.unit.test.ts';
import {
  CREATED,
  exists,
  liveOwner,
  recoverActions,
  recoveryFailure,
} from './commit-transaction-recovery-run-fixture.unit.test.ts';

const { isRegistryLockName, } = internalTestExports;

/**
 Writes a legacy single-journal transaction that crashed after preparing, holding the real index lock.

 @param repository - repository root

 @param directory - legacy transaction directory

 @param owner - recorded owner
 */
async function writeLegacyTransaction({
  repository,
  directory,
  owner,
}: Readonly<{
  repository: string;
  directory: string;
  owner: OwnerIdentity;
}>,): Promise<void> {
  /**
   Real index and its lock.
   */
  const indexPath = join(repository, '.git', 'index',);
  await mkdir(directory,);
  await copyFile(indexPath, join(directory, 'original.index',),);
  await copyFile(indexPath, join(directory, 'post.index',),);
  {
    /**
     Lock handle closed as a crash closes it.
     */
    await using _lock = await open(`${indexPath}.lock`, 'wx',);
  }
  /**
   Artifact identities the journal binds.
   */
  const [directoryStat, originalStat, postStat, lockStat,] = await Promise.all(
    [directory, join(directory, 'original.index',), join(directory, 'post.index',), `${indexPath}.lock`,].map(function identity(path,) {
      return lstat(path, { bigint: true, },);
    },),
  );
  if ((directoryStat === undefined) || (originalStat === undefined) || (postStat === undefined) || (lockStat === undefined))
    throw new Error('Legacy fixture artifacts are missing.',);
  /**
   Current commit.
   */
  const head = await headOid(repository,);
  await writeFile(join(directory, 'journal.json',), `${JSON.stringify({
    version: 1,
    ...owner,
    state: 'prepared',
    repositoryRoot: repository,
    realIndexPath: indexPath,
    reflogAction: 'cli-git:transaction:legacy',
    originalHead: { kind: 'oid', oid: head, },
    expectedParentOids: [head,],
    mode: 'index',
    selectedPaths: [],
    addedPaths: [],
    selectedWorktreePaths: [],
    intendedTreeOid: await runFixtureGit({ repository, args: ['rev-parse', 'HEAD^{tree}',], },),
    directoryDevice: String(directoryStat.dev,),
    directoryInode: String(directoryStat.ino,),
    originalIndexDevice: String(originalStat.dev,),
    originalIndexInode: String(originalStat.ino,),
    postIndexDevice: String(postStat.dev,),
    postIndexInode: String(postStat.ino,),
    lockFsId: (await resolveFsId({ path: `${indexPath}.lock`, emitDiagnostics: false, },)).value,
    lockDevice: String(lockStat.dev,),
    lockInode: String(lockStat.ino,),
  },)}\n`,);
}

await describe({
  name: 'registry entry recovery',
  children: [
    it({
      name: 'retains a dead staging candidate, skips a live one, and leaves unattributed candidates',
      fn: async function testStaging(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Dead owner stopped before publishing. */
        const dead = await stopTransaction({ repository: repository.path, phase: 'published', message: 'dead', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await rename(dead.directory, `${dead.directory}.pending`,);
        /** Live owner stopped before publishing. */
        const live = await stopTransaction({ repository: repository.path, phase: 'published', message: 'live', owner: await liveOwner(), createdAt: CREATED[1], },);
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
          'staging-retained',
          'staging-unattributed',
          'staging-unattributed',
        ],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([
          `${dead.transactionId}.pending`,
          `${live.transactionId}.pending`,
          basename(torn,),
          basename(empty,),
        ].toSorted(),);
      },
    },),
    it({
      name: 'removes a retired directory whose removal was interrupted',
      fn: async function testRetired(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Retired leftover. */
        const retired = join(repository.registryRoot, 'c0000000-0000-4000-8000-000000000000.retired',);
        await mkdir(retired, { recursive: true, },);
        await writeFile(join(retired, 'preparing.json',), '{}\n',);

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
        const moved = await stopTransaction({ repository: repository.path, phase: 'captured', message: 'moved', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await rewriteJsonRecord({ path: join(moved.directory, 'owner.json',), fields: { transactionId: 'e0000000-0000-4000-8000-000000000000', }, },);

        expect(await recoveryFailure(repository.path,),).toContain('names another transaction',);
        expect(await exists(moved.directory,),).toBe(true,);
      },
    },),
    it({
      name: 'fails closed on a registry directory holding an unreleased single-file journal',
      fn: async function testUnreleasedJournal(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Dead transaction carrying an unreleased journal file. */
        const unreleased = await stopTransaction({ repository: repository.path, phase: 'published', message: 'old', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await writeFile(join(unreleased.directory, 'journal.json',), '{}\n',);

        expect(await recoveryFailure(repository.path,),).toContain('unreleased journal format',);
        expect(await exists(unreleased.directory,),).toBe(true,);
      },
    },),
    it({
      name: 'retires a landing lock its dead owner left and then recovers the dead landing',
      fn: async function testStaleLandingLock(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'stale.txt', content: 'stale\n', },);
        /** Dead landing. */
        const landing = await stopTransaction({ repository: repository.path, phase: 'swapped', message: 'stale', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        /** Landing lock left by the dead lander. */
        const lock = join(repository.registryRoot, 'landing.lock',);
        await mkdir(lock,);
        /** Dead lander identity. */
        const dead = await exitedProcessIdentity();
        await writeFile(join(lock, 'owner.json',), `${JSON.stringify({ schemaVersion: 1, token: 'dead-token', ownerPid: dead.ownerPid, ownerBirthIdentity: dead.ownerIdentity, },)}\n`,);

        expect(await recoverActions(repository.path,),).toEqual(['index-installed',],);
        expect(await headOid(repository.path,),).toBe(landing.preparedOid,);
        expect(await recoveryLeftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'recognizes owner-lock entries and their candidates as registry locks, not transactions',
      fn: function testRegistryLockNames(): void {
        expect([
          'landing.lock',
          'landing.lock.0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10.pending',
          'reservation.lock',
          'reservation.lock.0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10.stale',
          'landing.locked',
          '0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10',
        ].map(function classify(name,): boolean {
          return isRegistryLockName(name,);
        },),).toEqual([true, true, true, true, false, false,],);
      },
    },),
    it({
      name: 'still recovers a legacy single-journal directory and skips its live owner',
      fn: async function testLegacyJournal(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await writeLegacyTransaction({ repository: repository.path, directory: repository.legacyDirectory, owner: await liveOwner(), },);

        expect(await recoverActions(repository.path,),).toEqual(['owner-active',],);
        await rewriteJsonRecord({ path: join(repository.legacyDirectory, 'journal.json',), fields: await exitedProcessIdentity(), },);
        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created',],);
        expect(await exists(repository.legacyDirectory,),).toBe(false,);
        expect(await exists(repository.lockPath,),).toBe(false,);
      },
    },),
  ],
},);
