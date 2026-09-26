/**
 Crashed invocations recovered by the next wrapper invocation on disposable repositories.

 @module
 */
import { once, } from 'node:events';
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  barrierSource,
  createLandingRepository,
  finish,
  git,
  leftovers,
  runWrapper,
  startWrapper,
  WRAPPER_PATH,
  waitForFile,
  writeHook,
  writeNodeProgram,
  writeWorktreeFile,
} from './commit-landing-fixture.unit.test.ts';
import { exitedProcessIdentity, } from './commit-transaction-recovery-fixture.unit.test.ts';
import { stopTransaction, } from './commit-transaction-recovery-phase-fixture.unit.test.ts';

/**
 Repository-local identity and signing configuration native preparation outside the wrapper needs.
 */
const PREPARATION_CONFIG: readonly (readonly [string, string])[] = [
  ['user.name', 'cli-git landing fixture',],
  ['user.email', 'landing@example.invalid',],
  ['commit.gpgSign', 'false',],
];

await describe({
  name: 'crashed commit recovery through the wrapper',
  children: [
    it({
      name: 'a commit killed with SIGKILL in its editor leaves nothing a later invocation cannot recover',
      fn: async function testKilledInEditor(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        /** Baseline commit. */
        const baseline = await git({ repository, args: ['rev-parse', 'HEAD',], },);
        /** Index before the killed commit. */
        const indexBefore = await readFile(join(repository.gitDir, 'index',),);
        /** Editor barrier files. */
        const ready = join(repository.scratch, 'editor.ready',);
        /** Editor program. */
        const editor = join(repository.scratch, 'editor.cjs',);
        await writeNodeProgram({ path: editor, source: barrierSource({ ready, release: join(repository.scratch, 'never',), },), },);
        /** Wrapper in its own process group, so the kill reaches the wrapper, native Git, and the editor. */
        const child = repository.processGroups.spawn({
          command: process.execPath,
          args: [WRAPPER_PATH, 'commit', '-e', '-m', 'killed', 'a.txt',],
          options: { cwd: repository.path, env: { ...repository.env, GIT_EDITOR: editor, }, stdio: 'ignore', },
        },);
        /** Exit notification registered before the kill. */
        const exited = once(child, 'exit',);
        await waitForFile({ path: ready, },);
        if (child.pid === undefined)
          throw new Error('Wrapper did not start.',);
        process.kill(-child.pid, 'SIGKILL',);
        await exited;
        expect((await leftovers(repository,)).length > 0,).toBe(true,);

        /** Next invocation, which recovers before forwarding. */
        const status = await runWrapper({ repository, args: ['status', '--porcelain',], },);
        expect(status.exitCode,).toBe(0,);
        expect(status.stdout,).toBe('?? a.txt\n',);
        expect(await leftovers(repository,),).toEqual([],);
        expect(await git({ repository, args: ['rev-parse', 'HEAD',], },),).toBe(baseline,);
        expect(
          await readFile(join(repository.gitDir, 'index',),),
        ).toEqual(indexBefore,);
      },
    },),
    ...(['landing-locked', 'objects-migrated',] as const).map(function killedInLanding(phase,) {
      return it({
        name: `a commit killed at ${phase} while another waits for the landing lock releases the real index.lock to that landing`,
        fn: async function testKilledInLanding(): Promise<void> {
          await using repository = await createLandingRepository();
          await writeWorktreeFile({ repository, name: 'victim.txt', content: 'victim\n', },);
          await writeWorktreeFile({ repository, name: 'bystander.txt', content: 'bystander\n', },);
          /** Marker the bystander's pre-commit writes once its startup recovery is behind it. */
          const preparing = join(repository.scratch, 'bystander-preparing',);
          await writeHook({ repository, event: 'pre-commit', source: `if (process.env.BYSTANDER === '1') require('node:fs').writeFileSync(${JSON.stringify(preparing,)}, '');`, },);
          /** Victim paused at the phase, holding the landing lock and the real index.lock. */
          const victim = repository.processGroups.spawn({
            command: process.execPath,
            args: [WRAPPER_PATH, 'commit', '-m', 'victim', 'victim.txt',],
            options: {
              cwd: repository.path,
              env: { ...repository.env, CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `${phase}:pause:${repository.scratch}`, },
              stdio: 'ignore',
            },
          },);
          /** Victim exit, registered before the kill. */
          const exited = once(victim, 'exit',);
          await waitForFile({ path: join(repository.scratch, `${phase}.reached`,), },);
          /** Bystander, which waits for the landing lock. */
          const bystander = finish(startWrapper({ repository, args: ['commit', '-m', 'bystander', 'bystander.txt',], env: { BYSTANDER: '1', }, },),);
          // Past its startup recovery, so only the landing-lock recovery can release the victim's index.lock.
          await waitForFile({ path: preparing, },);
          if (victim.pid === undefined)
            throw new Error('Victim did not start.',);
          process.kill(-victim.pid, 'SIGKILL',);
          await exited;
          /** Bystander outcome. */
          const outcome = await bystander;
          expect(outcome.exitCode,).toBe(0,);
          expect(outcome.stderr,).not.toContain('index.lock',);
          expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('bystander\nbaseline',);
          expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('?? victim.txt',);
          expect(await leftovers(repository,),).toEqual([],);
        },
      },);
    },),
    it({
      name: 'a landing that crashed after its compare-and-swap is completed before the next commit lands on top',
      fn: async function testCrashedLandingThenCommit(): Promise<void> {
        await using repository = await createLandingRepository(PREPARATION_CONFIG,);
        await writeFile(join(repository.path, 'crashed.txt',), 'crashed\n',);
        await git({ repository, args: ['add', 'crashed.txt',], },);
        /** Landing stopped after advancing the branch, still holding the real index lock. */
        const crashed = await stopTransaction({
          repository: repository.path,
          phase: 'swapped',
          message: 'crashed',
          owner: await exitedProcessIdentity(),
          createdAt: '2026-01-01T00:00:01.000Z',
        },);
        await writeWorktreeFile({ repository, name: 'next.txt', content: 'next\n', },);

        /** Next commit. */
        const next = await runWrapper({ repository, args: ['commit', '-m', 'next', 'next.txt',], },);
        expect(next.exitCode,).toBe(0,);
        expect(next.stderr,).not.toContain('index.lock',);
        expect(await git({ repository, args: ['log', '--format=%s',], },),).toBe('next\ncrashed\nbaseline',);
        expect(await git({ repository, args: ['rev-parse', 'HEAD~1',], },),).toBe(crashed.preparedOid,);
        expect(await git({ repository, args: ['status', '--porcelain',], },),).toBe('',);
        expect(await leftovers(repository,),).toEqual([],);
      },
    },),
  ],
},);
