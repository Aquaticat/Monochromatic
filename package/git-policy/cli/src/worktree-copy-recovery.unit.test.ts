/**
 Worktree-copy transactions that end without blocking later commands:
 recovery of an installation its owner never finished,
 a failed installation,
 a destination worktree removed before recovery,
 and unrelated commands while a live owner holds settlement.

 @module
 */
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
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

/**
 Private mode of every hand-built stage directory and journal directory.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Source directory mode that an interrupted installation has not applied yet.
 */
const SOURCE_DIRECTORY_MODE = 0o755;

/**
 Source file mode.
 */
const SOURCE_FILE_MODE = 0o644;

/**
 One durable created-path identity as the journal records it.
 */
type CreatedIdentity = Readonly<{
  /**
   Device number in decimal.
   */
  device: string;
  /**
   Inode number in decimal.
   */
  inode: string;
  /**
   Repository path.
   */
  relativePath: string;
  /**
   Whether the path is a selected ignored entry.
   */
  selected: boolean;
}>;

/**
 Paths of one hand-built interrupted transaction.
 */
type InterruptedTransaction = Readonly<{
  /**
   Journal file.
   */
  journalPath: string;
  /**
   Private stage container beside the destination.
   */
  stageContainer: string;
}>;

/**
 Reads the durable identity of one destination path.

 @param root - destination root

 @param relativePath - repository path

 @returns identity as the journal records it

 @example
 ```ts
 await identityOf({ root: '/wt', relativePath: 'cache' });
 ```
 */
async function identityOf({
  root,
  relativePath,
}: Readonly<{
  root: string;
  relativePath: string;
}>,): Promise<CreatedIdentity> {
  /**
   No-follow identity.
   */
  const stats = await lstat(join(root, relativePath,), { bigint: true, },);
  return {
    device: stats.dev.toString(),
    inode: stats.ino.toString(),
    relativePath,
    selected: true,
  };
}

/**
 Builds the stage and journal an owner killed during installation leaves behind:
 a staged `cache` directory holding `data.txt`,
 and a destination `cache` directory created with the private installation mode.

 @param repositoryRoot - linked source worktree

 @param destinationRoot - registered destination worktree

 @param recordCreated - whether the journal already recorded the destination directory's identity

 @returns journal and stage paths

 @example
 ```ts
 await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: true });
 ```
 */
async function writeInterruptedInstallation({
  repositoryRoot,
  destinationRoot,
  recordCreated,
}: Readonly<{
  repositoryRoot: string;
  destinationRoot: string;
  recordCreated: boolean;
}>,): Promise<InterruptedTransaction> {
  /**
   Private stage container.
   */
  const stageContainer = join(dirname(destinationRoot,), '.cli-git-worktree-copy-interrupted',);
  /**
   Staged payload root.
   */
  const stageRoot = join(stageContainer, 'payload',);
  await mkdir(join(stageRoot, 'cache',), { recursive: true, mode: PRIVATE_DIRECTORY_MODE, },);
  await writeFile(join(stageRoot, 'cache', 'data.txt',), 'staged\n',);
  await chmod(join(stageRoot, 'cache', 'data.txt',), SOURCE_FILE_MODE,);
  await chmod(join(stageRoot, 'cache',), SOURCE_DIRECTORY_MODE,);
  await chmod(stageRoot, PRIVATE_DIRECTORY_MODE,);
  await chmod(stageContainer, PRIVATE_DIRECTORY_MODE,);
  await mkdir(join(destinationRoot, 'cache',), { mode: PRIVATE_DIRECTORY_MODE, },);
  await chmod(join(destinationRoot, 'cache',), PRIVATE_DIRECTORY_MODE,);
  /**
   Common Git directory holding journals.
   */
  const commonDir = await resolveFixtureCommonDir(repositoryRoot,);
  /**
   Private journal root.
   */
  const journalRoot = join(commonDir, 'cli-git-worktree-copy', 'v1',);
  await mkdir(journalRoot, { recursive: true, mode: PRIVATE_DIRECTORY_MODE, },);
  await chmod(join(commonDir, 'cli-git-worktree-copy',), PRIVATE_DIRECTORY_MODE,);
  await chmod(journalRoot, PRIVATE_DIRECTORY_MODE,);
  /**
   Journal file.
   */
  const journalPath = join(journalRoot, 'interrupted.json',);
  await writeFile(
    journalPath,
    `${JSON.stringify({
      createdEntries: recordCreated
        ? [await identityOf({ root: destinationRoot, relativePath: 'cache', },),]
        : [],
      destinationRoot,
      intendedEntries: ['cache',],
      phase: 'installing',
      selectedRoots: ['cache',],
      sourceRoot: repositoryRoot,
      stageContainer,
      stageRoot,
      version: 1,
    },)}\n`,
    { mode: 0o600, },
  );
  return {
    journalPath,
    stageContainer,
  };
}

/**
 Lists journal-directory entries left under the common Git directory.

 @param repositoryRoot - linked source worktree

 @returns journal-directory entry names

 @example
 ```ts
 await journalNames('/tmp/repository');
 ```
 */
async function journalNames(repositoryRoot: string,): Promise<readonly string[]> {
  /**
   Common Git directory.
   */
  const commonDir = await resolveFixtureCommonDir(repositoryRoot,);
  try {
    return await readdir(join(commonDir, 'cli-git-worktree-copy', 'v1',),);
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
}

/**
 Lists private stages left beside a destination.

 @param destinationRoot - destination worktree

 @returns stage directory names

 @example
 ```ts
 await stageNames('/tmp/topic');
 ```
 */
async function stageNames(destinationRoot: string,): Promise<readonly string[]> {
  return (await readdir(dirname(destinationRoot,),)).filter(function isStage(name,): boolean {
    return name.startsWith('.cli-git-worktree-copy-',);
  },);
}

/**
 Creates a linked source and a registered destination worktree made by real Git.

 @param fixturePath - disposable fixture root

 @param branch - destination branch and directory name

 @returns source and destination roots

 @example
 ```ts
 await sourceAndDestination({ fixturePath: '/tmp/f', branch: 'topic' });
 ```
 */
async function sourceAndDestination({
  fixturePath,
  branch,
}: Readonly<{
  fixturePath: string;
  branch: string;
}>,): Promise<Readonly<{ repositoryRoot: string; destinationRoot: string; }>> {
  /**
   Linked source worktree.
   */
  const repositoryRoot = join(fixturePath, 'repository',);
  /**
   Destination worktree.
   */
  const destinationRoot = join(fixturePath, branch,);
  await initializeRepository(repositoryRoot,);
  await runRealGit({ cwd: repositoryRoot, args: ['worktree', 'add', '-b', branch, destinationRoot,], },);
  return {
    repositoryRoot,
    destinationRoot,
  };
}

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
