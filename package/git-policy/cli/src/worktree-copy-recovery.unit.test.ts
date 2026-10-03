/**
 Worktree-copy transactions that end without blocking later commands:
 recovery of an installation its owner never finished,
 a failed installation,
 a destination worktree removed before recovery,
 and unrelated commands while a live owner holds settlement.

 @module
 */
import {
  mkdir,
  readdir,
  readFile,
  rm,
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
  waitForFile,
  writeNodeProgram,
} from './policy-engine/commit-landing-fixture.unit.test.ts';
import { createProcessGroups, } from './policy-engine/process-group-fixture.unit.test.ts';
import {
  captureWrapper,
  commitPaths,
  createTempDirectory,
  initializeRepository,
  permissionMode,
  requireFailure,
  requireSuccess,
  resolveFixtureCommonDir,
  runRealGit,
  WRAPPER_PATH,
} from './worktree-copy-fixture.unit.test.ts';
import {
  journalNames,
  SOURCE_DIRECTORY_MODE,
  sourceAndDestination,
  stageNames,
  writeInterruptedInstallation,
} from './worktree-copy-recovery-fixture.unit.test.ts';

await describe({
  name: 'worktree-copy transaction termination',
  concurrency: 1,
  children: [
    it({
      name: 'recovers an installation interrupted after it created a selected directory with its private mode',
      fn: async function testRecordedDirectory(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Source and destination. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'recorded-topic', },);
        /** Interrupted transaction. */
        const transaction = await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: true, },);

        /** Next unrelated command. */
        const result = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(result.stderr,).toContain('recovered ignored-state copies for 1 worktree transaction',);
        expect(await readFile(join(destinationRoot, 'cache', 'data.txt',), 'utf8',),).toBe('staged\n',);
        expect(
          await permissionMode(join(destinationRoot, 'cache',),),
        ).toBe(SOURCE_DIRECTORY_MODE,);
        expect(await journalNames(repositoryRoot,),).toEqual([],);
        expect(await stageNames(destinationRoot,),).not.toContain('.cli-git-worktree-copy-interrupted',);
        void transaction;
      },
    },),

    it({
      name: 'recovers an installation interrupted between claiming a selected directory and recording its identity',
      fn: async function testIntendedDirectory(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Source and destination. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'intended-topic', },);
        await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: false, },);

        /** Next unrelated command. */
        const result = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(result.stderr,).toContain('recovered ignored-state copies for 1 worktree transaction',);
        expect(await readFile(join(destinationRoot, 'cache', 'data.txt',), 'utf8',),).toBe('staged\n',);
        expect(
          await permissionMode(join(destinationRoot, 'cache',),),
        ).toBe(SOURCE_DIRECTORY_MODE,);
        expect(await journalNames(repositoryRoot,),).toEqual([],);
      },
    },),

    it({
      name: 'a failed installation ends its transaction, so later commands in linked worktrees still run',
      fn: async function testFailedInstallation(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Linked source worktree. */
        const repositoryRoot = join(fixture.path, 'repository',);
        /** Destination whose checkout tracks a differing entry. */
        const destinationRoot = join(fixture.path, 'collision-topic',);
        await initializeRepository(repositoryRoot,);
        await writeFile(join(repositoryRoot, 'state.txt',), 'tracked old\n',);
        await commitPaths({ repositoryRoot, message: 'track old state', paths: ['state.txt',], },);
        await runRealGit({ cwd: repositoryRoot, args: ['branch', 'old',], },);
        await rm(join(repositoryRoot, 'state.txt',),);
        await writeFile(join(repositoryRoot, '.gitignore',), 'state.txt\n',);
        await commitPaths({ repositoryRoot, message: 'ignore state', paths: ['.gitignore', 'state.txt',], },);
        await writeFile(join(repositoryRoot, 'state.txt',), 'ignored new\n',);

        /** Creation whose copy collides. */
        const failure = requireFailure(await captureWrapper({ cwd: repositoryRoot, args: ['worktree', 'add', destinationRoot, 'old',], },),);
        expect(failure.exitCode,).toBe(2,);
        expect(failure.stderr,).toContain('would overwrite differing destination entry',);

        /** Later commands from the source and from the destination. */
        const [fromSource, fromDestination,] = [
          await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),
          await captureWrapper({ cwd: destinationRoot, args: ['status', '--short',], },),
        ];
        expect(requireSuccess(fromSource,).stderr,).not.toContain('cli-git:',);
        expect(requireSuccess(fromDestination,).stderr,).not.toContain('cli-git:',);
        expect(await journalNames(repositoryRoot,),).toEqual([],);
        expect(await stageNames(destinationRoot,),).toEqual([],);
        expect(await readFile(join(destinationRoot, 'state.txt',), 'utf8',),).toBe('tracked old\n',);
      },
    },),

    it({
      name: 'a failed installation removes the directories it created before failing',
      fn: async function testRollbackDirectories(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Linked source worktree. */
        const repositoryRoot = join(fixture.path, 'repository',);
        /** Destination whose hook makes a later parent unwritable. */
        const destinationRoot = join(fixture.path, 'rollback-topic',);
        await initializeRepository(repositoryRoot,);
        await mkdir(join(repositoryRoot, 'zzz',),);
        await writeFile(join(repositoryRoot, 'zzz', 'tracked.txt',), 'tracked\n',);
        await writeFile(join(repositoryRoot, '.gitignore',), 'cache/\nzzz/sub/\n',);
        await commitPaths({ repositoryRoot, message: 'track zzz and ignore state', paths: ['.gitignore', 'zzz/tracked.txt',], },);
        await mkdir(join(repositoryRoot, 'cache', 'nested',), { recursive: true, },);
        await writeFile(join(repositoryRoot, 'cache', 'nested', 'file.txt',), 'cached\n',);
        await mkdir(join(repositoryRoot, 'zzz', 'sub',),);
        await writeFile(join(repositoryRoot, 'zzz', 'sub', 'data.txt',), 'data\n',);
        /** Shared hooks directory. */
        const hooks = join(await resolveFixtureCommonDir(repositoryRoot,), 'hooks',);
        await mkdir(hooks, { recursive: true, },);
        await writeNodeProgram({
          path: join(hooks, 'post-checkout',),
          source: 'require("node:fs").chmodSync("zzz", 0o555);',
        },);

        /** Creation whose installation fails at the unwritable parent. */
        const failure = requireFailure(await captureWrapper({ cwd: repositoryRoot, args: ['worktree', 'add', '-b', 'rollback-topic', destinationRoot,], },),);

        expect(failure.exitCode,).toBe(2,);
        expect(failure.stderr,).toContain('ignored-state installation failed',);
        expect(failure.stderr,).not.toContain('Rollback retained',);
        expect(await readdir(destinationRoot,),).not.toContain('cache',);
        expect(await journalNames(repositoryRoot,),).toEqual([],);
        expect(await stageNames(destinationRoot,),).toEqual([],);
      },
    },),

    it({
      name: 'discards an interrupted transaction whose destination worktree was removed',
      fn: async function testRemovedDestination(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Source and destination. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'removed-topic', },);
        await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: true, },);
        await runRealGit({ cwd: repositoryRoot, args: ['worktree', 'remove', '--force', destinationRoot,], },);

        /** Next unrelated command. */
        const result = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(result.stderr,).toContain('discarded an interrupted ignored-state copy',);
        expect(result.stderr,).toContain(JSON.stringify(destinationRoot,),);
        expect(await journalNames(repositoryRoot,),).toEqual([],);
        expect(await stageNames(destinationRoot,),).toEqual([],);
      },
    },),

    it({
      name: 'an unrelated command skips recovery while a live worktree-creating command holds settlement',
      fn: async function testLiveOwner(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Process groups killed before the directory is removed. */
        await using groups = createProcessGroups();
        /** Source and a destination for the hand-built pending journal. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'pending-topic', },);
        /** Barrier files. */
        const ready = join(fixture.path, 'holder.ready',);
        /** Barrier release. */
        const release = join(fixture.path, 'holder.release',);
        /** Shared hooks directory. */
        const hooks = join(await resolveFixtureCommonDir(repositoryRoot,), 'hooks',);
        await mkdir(hooks, { recursive: true, },);
        await writeNodeProgram({ path: join(hooks, 'post-checkout',), source: barrierSource({ ready, release, },), },);
        /** Wrapped worktree creation, holding settlement while its hook waits. */
        const holder = groups.spawn({
          command: process.execPath,
          args: [WRAPPER_PATH, 'worktree', 'add', '-b', 'held-topic', join(fixture.path, 'held-topic',),],
          options: { cwd: repositoryRoot, stdio: 'ignore', },
        },);
        await waitForFile({ path: ready, },);
        /** Pending journal that appeared while the owner is live. */
        const transaction = await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: true, },);

        /** Concurrent unrelated command. */
        const status = await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },);

        expect(holder.exitCode,).toBeNull();
        expect(requireSuccess(status,).stderr,).not.toContain('worktree-copy settlement',);
        expect(await readFile(transaction.journalPath, 'utf8',),).toContain('pending-topic',);
        await writeFile(release, '',);
      },
    },),
  ],
},);
