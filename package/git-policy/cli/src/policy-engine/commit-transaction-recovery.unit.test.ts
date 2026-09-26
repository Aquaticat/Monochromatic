/**
 Startup recovery of schema-version-2 transactions stopped at every phase, on disposable real-Git repositories.

 @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  createRecoveryRepository,
  exitedProcessIdentity,
  headOid,
  recoveryLeftovers,
  registryEntries,
  runFixtureGit,
  stageFile,
} from './commit-transaction-recovery-fixture.unit.test.ts';
import {
  stopTransaction,
  TRANSACTION_PHASES,
  type TransactionPhase,
} from './commit-transaction-recovery-phase-fixture.unit.test.ts';
import {
  CREATED,
  exists,
  liveOwner,
  recoverActions,
  recoveryFailure,
} from './commit-transaction-recovery-run-fixture.unit.test.ts';

const { recoverCommitTransaction, } = internalTestExports;

/**
 Recovery action each crash phase must produce.
 */
const PHASE_ACTIONS: Readonly<Record<TransactionPhase, string>> = {
  'published': 'commit-not-created',
  'captured': 'commit-not-created',
  'shadowed': 'commit-not-created',
  'prepared': 'commit-not-created',
  'index-locked': 'commit-not-created',
  'migrated': 'commit-not-created',
  'landing-recorded': 'commit-not-created',
  'swapped': 'index-installed',
  'ref-updated': 'index-installed',
  'index-installed': 'already-installed',
  'marked': 'already-installed',
};

/**
 Reports whether a phase lies in an inclusive phase range.

 @param phase - phase

 @param from - first phase of the range

 @param to - last phase of the range

 @returns membership
 */
function inPhases({
  phase,
  from,
  to,
}: Readonly<{
  phase: TransactionPhase;
  from: TransactionPhase;
  to: TransactionPhase;
}>,): boolean {
  /**
   Phase position.
   */
  const position = TRANSACTION_PHASES.indexOf(phase,);
  return (position >= TRANSACTION_PHASES.indexOf(from,)) && (position <= TRANSACTION_PHASES.indexOf(to,));
}

await describe({
  name: recoverCommitTransaction.name,
  children: [
    //region Crash phases

    ...TRANSACTION_PHASES.map(function phaseTest(phase,) {
      return it({
        name: `a dead owner stopped after ${phase} is recovered as ${PHASE_ACTIONS[phase]} with nothing left behind`,
        fn: async function testPhase(): Promise<void> {
          await using repository = await createRecoveryRepository();
          await stageFile({ repository: repository.path, name: 'staged.txt', content: 'staged\n', },);
          /** Baseline commit. */
          const baseline = await headOid(repository.path,);
          /** Real index before the transaction. */
          const indexBefore = await readFile(repository.indexPath,);
          /** Stopped transaction. */
          const stopped = await stopTransaction({
            repository: repository.path,
            phase,
            message: phase,
            owner: await exitedProcessIdentity(),
            createdAt: CREATED[0],
          },);
          /** Whether the target advanced before the crash. */
          const landed = PHASE_ACTIONS[phase] !== 'commit-not-created';
          /** Index recovery must leave. */
          const expectedIndex = landed ? await readFile(stopped.postIndexPath,) : indexBefore;
          /** Kinds of crash evidence present before recovery, proving the phase left what it claims. */
          const evidence = (await recoveryLeftovers(repository,)).map(function kindOf(name,): string {
            if (name.startsWith('shadow/',))
              return 'shadow';
            return name.endsWith('.keep',) ? 'keep' : name;
          },);
          expect(evidence,).toEqual([
            ...(inPhases({ phase, from: 'shadowed', to: 'marked', },) ? ['shadow',] : []),
            ...(inPhases({ phase, from: 'migrated', to: 'swapped', },) ? ['keep',] : []),
            stopped.transactionId,
            ...(inPhases({ phase, from: 'index-locked', to: 'ref-updated', },) ? ['index.lock', 'index~pid.lock',] : []),
          ],);

          expect(await recoverActions(repository.path,),).toEqual([PHASE_ACTIONS[phase],],);
          expect(await recoveryLeftovers(repository,),).toEqual([],);
          expect(await headOid(repository.path,),).toBe(landed ? stopped.preparedOid : baseline,);
          expect(await readFile(repository.indexPath,),).toEqual(expectedIndex,);
          expect(await runFixtureGit({ repository: repository.path, args: ['status', '--porcelain',], },),).toBe(landed ? '' : 'A  staged.txt',);
          expect(await recoverActions(repository.path,),).toEqual([],);
        },
      },);
    },),

    //endregion Crash phases

    //region Several transactions

    it({
      name: 'recovers the dead landing under the landing lock first, then the unlanded transactions oldest first',
      fn: async function testSeveralDeadTransactions(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'first.txt', content: 'first\n', },);
        await stopTransaction({ repository: repository.path, phase: 'published', message: 'published', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        /** Landing that advanced the branch but crashed before installing its index. */
        const landing = await stopTransaction({ repository: repository.path, phase: 'swapped', message: 'landed', owner: await exitedProcessIdentity(), createdAt: CREATED[1], },);
        // Prepared on top of the landed commit while the dead landing still held the lock.
        await stopTransaction({ repository: repository.path, phase: 'prepared', message: 'prepared', owner: await exitedProcessIdentity(), createdAt: CREATED[2], },);

        expect(await recoverActions(repository.path,),).toEqual(['index-installed', 'commit-not-created', 'commit-not-created',],);
        expect(await recoveryLeftovers(repository,),).toEqual([],);
        expect(await headOid(repository.path,),).toBe(landing.preparedOid,);
        expect(await runFixtureGit({ repository: repository.path, args: ['status', '--porcelain',], },),).toBe('',);
      },
    },),
    it({
      name: 'skips a live owner while recovering a dead one beside it',
      fn: async function testLiveOwnerSkipped(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'live.txt', content: 'live\n', },);
        await stopTransaction({ repository: repository.path, phase: 'prepared', message: 'dead', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        /** Transaction owned by this still-running test process. */
        const live = await stopTransaction({ repository: repository.path, phase: 'prepared', message: 'live', owner: await liveOwner(), createdAt: CREATED[1], },);

        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created', 'owner-active',],);
        expect(await registryEntries(repository.registryRoot,),).toEqual([live.transactionId,],);
        expect(await exists(live.shadowPath,),).toBe(true,);
      },
    },),
    it({
      name: 'treats an owner PID that now names another process as dead and releases its lock',
      fn: async function testReusedPid(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stopTransaction({
          repository: repository.path,
          phase: 'index-locked',
          message: 'reused',
          owner: { ownerPid: process.pid, ownerIdentity: 'linux:0', },
          createdAt: CREATED[0],
        },);

        expect(await recoverActions(repository.path,),).toEqual(['commit-not-created',],);
        expect(await recoveryLeftovers(repository,),).toEqual([],);
      },
    },),

    //endregion Several transactions

    //region Landed-or-not evidence

    it({
      name: 'finds the transaction nonce below a later same-commit reflog entry',
      fn: async function testNonceBelowNewest(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'deep.txt', content: 'deep\n', },);
        /** Landing crashed after its compare-and-swap. */
        const landing = await stopTransaction({ repository: repository.path, phase: 'swapped', message: 'deep', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        /** Post-index recovery must install. */
        const postIndex = await readFile(landing.postIndexPath,);
        await runFixtureGit({
          repository: repository.path,
          args: ['update-ref', '-m', 'external same-commit movement', 'refs/heads/main', landing.preparedOid, landing.preparedOid,],
        },);

        expect(await recoverActions(repository.path,),).toEqual(['index-installed',],);
        expect(await readFile(repository.indexPath,),).toEqual(postIndex,);
        expect(await recoveryLeftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'uses the durable ref-updated record without consulting the reflog',
      fn: async function testRefUpdatedRecord(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'marker.txt', content: 'marker\n', },);
        await stopTransaction({ repository: repository.path, phase: 'ref-updated', message: 'marker', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await runFixtureGit({ repository: repository.path, args: ['reflog', 'expire', '--expire=all', '--all',], },);

        expect(await recoverActions(repository.path,),).toEqual(['index-installed',],);
        expect(await recoveryLeftovers(repository,),).toEqual([],);
      },
    },),
    it({
      name: 'fails closed and retains evidence when the branch contains the commit but its reflog lacks the nonce',
      fn: async function testNonceMissing(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'missing.txt', content: 'missing\n', },);
        /** Landing whose branch reflog entry is deleted. */
        const landing = await stopTransaction({ repository: repository.path, phase: 'swapped', message: 'missing', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await runFixtureGit({ repository: repository.path, args: ['reflog', 'delete', 'refs/heads/main@{0}',], },);

        expect(await recoveryFailure(repository.path,),).toContain('but its reflog lacks the nonce entry',);
        expect(await exists(landing.directory,),).toBe(true,);
        expect(await exists(landing.shadowPath,),).toBe(true,);
        expect(await exists(repository.lockPath,),).toBe(true,);
      },
    },),
    it({
      name: 'fails closed when the real index changed after a landed compare-and-swap',
      fn: async function testIndexChanged(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await stageFile({ repository: repository.path, name: 'changed.txt', content: 'changed\n', },);
        /** Landing crashed after its compare-and-swap. */
        const landing = await stopTransaction({ repository: repository.path, phase: 'swapped', message: 'changed', owner: await exitedProcessIdentity(), createdAt: CREATED[0], },);
        await writeFile(repository.indexPath, 'index bytes written around the lock\n',);

        expect(await recoveryFailure(repository.path,),).toContain('Real index no longer matches the pre-landing snapshot',);
        expect(await exists(landing.directory,),).toBe(true,);
      },
    },),

    //endregion Landed-or-not evidence
  ],
},);
