/**
 Worktree-copy owners that stop mid-transaction:
 a creation killed after its journal appeared,
 an install log whose last append never finished or holds a corrupt line,
 and a private stage removed by hand.

 @module
 */
import { once, } from 'node:events';
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createProcessGroups, } from './policy-engine/process-group-fixture.unit.test.ts';
import {
  captureWrapper,
  commitPaths,
  createTempDirectory,
  initializeRepository,
  requireFailure,
  requireSuccess,
  resolveFixtureCommonDir,
  WRAPPER_PATH,
} from './worktree-copy-fixture.unit.test.ts';
import {
  journalNames,
  sourceAndDestination,
  stageNames,
  writeInterruptedInstallation,
} from './worktree-copy-recovery-fixture.unit.test.ts';

/**
 Ignored package directories in the killed-creation tree.
 */
const PACKAGE_COUNT = 80;

/**
 Files in each ignored package directory.
 */
const FILES_PER_PACKAGE = 30;

/**
 Mode of every file in the killed-creation tree whose index is a multiple of three.
 */
const EXECUTABLE_MODE = 0o755;

/**
 Interval between journal-directory polls while the creation runs.
 */
const JOURNAL_POLL_MS = 2;

/**
 Deadline for the killed creation to publish its journal.
 */
const JOURNAL_DEADLINE_MS = 60_000;

/**
 Private install-log file name inside a stage container.
 */
const INSTALL_LOG_NAME = 'install-log.jsonl';

/**
 One entry of a compared ignored tree.
 */
type TreeEntry = Readonly<{
  /**
   Path relative to the compared root.
   */
  path: string;
  /**
   Kind, permission bits, and content or link target.
   */
  shape: string;
}>;

/**
 Log directory the wrapper's own logger writes beneath the nearest `node_modules`.
 Every later wrapped command in the source appends a new log file there,
 so it cannot match a copy taken earlier.
 */
const LOGGER_DIRECTORY = '.monochromatic';

/**
 Lists a tree in path order with kind, permission bits, and content or target,
 omitting the wrapper's own log directory.

 @param root - tree root

 @returns entries sorted by path

 @example
 ```ts
 await describeTree('/repo/node_modules');
 ```
 */
async function describeTree(root: string,): Promise<readonly TreeEntry[]> {
  /**
   Every descendant path.
   */
  const paths = (await readdir(root, { recursive: true, },))
    .filter(function isCopiedState(path,): boolean {
      return (path !== LOGGER_DIRECTORY) && (!path.startsWith(`${LOGGER_DIRECTORY}/`,));
    },)
    .toSorted();
  return Promise.all(paths.map(async function describeEntry(path,): Promise<TreeEntry> {
    /** Entry path. */
    const absolute = join(root, path,);
    /** No-follow metadata. */
    const stats = await lstat(absolute,);
    /** Permission bits. */
    const mode = (stats.mode & 0o7777).toString(8,);
    if (stats.isSymbolicLink())
      return { path, shape: `symlink ${await readlink(absolute,)}`, };
    if (stats.isDirectory())
      return { path, shape: `directory ${mode}`, };
    return { path, shape: `file ${mode} ${await readFile(absolute, 'utf8',)}`, };
  },),);
}

/**
 Writes an ignored `node_modules` tree with files, executable files, and package symbolic links.

 @param repositoryRoot - linked source worktree

 @example
 ```ts
 await writeDependencyTree('/tmp/repository');
 ```
 */
async function writeDependencyTree(repositoryRoot: string,): Promise<void> {
  await writeFile(join(repositoryRoot, '.gitignore',), 'node_modules/\n',);
  await commitPaths({ repositoryRoot, message: 'ignore dependencies', paths: ['.gitignore',], },);
  /** Package indices. */
  const packages = Array.from({ length: PACKAGE_COUNT, }, function packageIndex(_unused, index,): number {
    return index;
  },);
  for (const index of packages) {
    /** Package directory. */
    const directory = join(repositoryRoot, 'node_modules', '.store', `package-${String(index,)}`,);
    // oxlint-disable-next-line no-await-in-loop -- one package at a time keeps file-descriptor use bounded
    await mkdir(directory, { recursive: true, },);
    // oxlint-disable-next-line no-await-in-loop -- one package at a time keeps file-descriptor use bounded
    await Promise.all(Array.from({ length: FILES_PER_PACKAGE, }, async function writeModule(_file, fileIndex,): Promise<void> {
      /** Module path. */
      const path = join(directory, `module-${String(fileIndex,)}.js`,);
      await writeFile(path, `export default ${String((index * FILES_PER_PACKAGE) + fileIndex,)};\n`,);
      if ((fileIndex % 3) === 0)
        await chmod(path, EXECUTABLE_MODE,);
    },),);
    // oxlint-disable-next-line no-await-in-loop -- one package at a time keeps file-descriptor use bounded
    await symlink(join('.store', `package-${String(index,)}`,), join(repositoryRoot, 'node_modules', `package-${String(index,)}`,),);
  }
}

/**
 Reports whether a directory entry name is a published journal.

 @param name - directory entry name

 @returns whether the name ends in `.json`

 @example
 ```ts
 isJournalName('id.json');
 // => true
 ```
 */
function isJournalName(name: string,): boolean {
  return name.endsWith('.json',);
}

/**
 Accepts every directory entry name.

 @returns true

 @example
 ```ts
 isAnyName();
 // => true
 ```
 */
function isAnyName(): boolean {
  return true;
}

/**
 Polls until a directory holds an entry the predicate accepts, or the deadline passes.

 @param directory - polled directory, possibly not created yet

 @param predicate - accepts a qualifying entry name

 @returns whether a qualifying entry appeared

 @example
 ```ts
 await pathAppeared({ directory: '/repo/.git/cli-git-worktree-copy/v1', predicate: isJournalName });
 ```
 */
async function pathAppeared({
  directory,
  predicate,
}: Readonly<{
  directory: string;
  predicate: (name: string) => boolean;
}>,): Promise<boolean> {
  /** Deadline. */
  const deadline = Date.now() + JOURNAL_DEADLINE_MS;
  while (Date.now() < deadline) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- polling observes the directory in order
      if ((await readdir(directory,)).some(predicate,))
        return true;
    }
    catch (error: unknown) {
      if (!(Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT')))
        throw error;
    }
    // oxlint-disable-next-line no-await-in-loop -- polling delay
    await wait(JOURNAL_POLL_MS,);
  }
  return false;
}

await describe({
  name: 'worktree-copy interruption',
  concurrency: 1,
  children: [
    it({
      name: 'a creation killed after it began installing is finished by the next command, and the destination matches the source',
      fn: async function testKilledCreation(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Process groups killed before the directory is removed. */
        await using groups = createProcessGroups();
        /** Linked source worktree. */
        const repositoryRoot = join(fixture.path, 'repository',);
        await initializeRepository(repositoryRoot,);
        await writeDependencyTree(repositoryRoot,);
        /** Destination worktree. */
        const destinationRoot = join(fixture.path, 'killed-topic',);
        /** Private journal directory. */
        const journalRoot = join(await resolveFixtureCommonDir(repositoryRoot,), 'cli-git-worktree-copy', 'v1',);
        /** Wrapped creation killed once its journal exists. */
        const creation = groups.spawn({
          command: process.execPath,
          args: [WRAPPER_PATH, 'worktree', 'add', '-b', 'killed-topic', destinationRoot,],
          options: { cwd: repositoryRoot, stdio: 'ignore', },
        },);
        /** Creation exit. */
        const exited = once(creation, 'exit',);
        expect(await pathAppeared({ directory: journalRoot, predicate: isJournalName, },),).toBe(true,);
        expect(await pathAppeared({ directory: join(destinationRoot, 'node_modules', '.store',), predicate: isAnyName, },),).toBe(true,);
        creation.kill('SIGKILL',);
        await exited;
        expect((await journalNames(repositoryRoot,)).some(isJournalName,),).toBe(true,);

        /** Next unrelated command. */
        const result = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(result.stderr,).toContain('recovered ignored-state copies for 1 worktree transaction',);
        expect(
          await describeTree(join(destinationRoot, 'node_modules',),),
        ).toEqual(
          await describeTree(join(repositoryRoot, 'node_modules',),),
        );
        expect(await journalNames(repositoryRoot,),).toEqual([],);
        expect(await stageNames(destinationRoot,),).toEqual([],);
      },
    },),

    it({
      name: 'recovery drops an unfinished trailing install-log append and finishes the copy',
      fn: async function testTornAppend(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Source and destination. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'torn-topic', },);
        /** Interrupted transaction. */
        const transaction = await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: false, },);
        await writeFile(join(transaction.stageContainer, INSTALL_LOG_NAME,), '{"intended":["cache"]}\n{"created":[{"dev', { mode: 0o600, },);

        /** Next unrelated command. */
        const result = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(result.stderr,).toContain('recovered ignored-state copies for 1 worktree transaction',);
        expect(await readFile(join(destinationRoot, 'cache', 'data.txt',), 'utf8',),).toBe('staged\n',);
        expect(await journalNames(repositoryRoot,),).toEqual([],);
      },
    },),

    it({
      name: 'a corrupt complete install-log line keeps the journal and fails closed',
      fn: async function testCorruptLine(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Source and destination. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'corrupt-topic', },);
        /** Interrupted transaction. */
        const transaction = await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: false, },);
        await writeFile(join(transaction.stageContainer, INSTALL_LOG_NAME,), '{"unexpected":true}\n', { mode: 0o600, },);

        /** Next unrelated command. */
        const failure = requireFailure(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(failure.exitCode,).toBe(2,);
        expect(failure.stderr,).toContain('install log is corrupt',);
        expect(await readFile(transaction.journalPath, 'utf8',),).toContain('corrupt-topic',);
      },
    },),

    it({
      name: 'an unfinished trailing install-log append is cut off before recovery appends to the log',
      fn: async function testTruncatedAppend(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Source and destination. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'cut-topic', },);
        /** Interrupted transaction. */
        const transaction = await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: false, },);
        /** Install log whose complete line claims a path the stage lacks, so recovery stops after opening it. */
        const logPath = join(transaction.stageContainer, INSTALL_LOG_NAME,);
        await writeFile(logPath, '{"intended":["cache","absent"]}\n{"created":[{"dev', { mode: 0o600, },);

        /** Recovery that fails closed after opening the log. */
        const failure = requireFailure(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(failure.stderr,).toContain('journal intent is absent from private stage',);
        expect(await readFile(logPath, 'utf8',),).toBe('{"intended":["cache","absent"]}\n',);
        expect(await readFile(transaction.journalPath, 'utf8',),).toContain('cut-topic',);
      },
    },),

    it({
      name: 'discards an interrupted transaction whose private stage was removed',
      fn: async function testMissingStage(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Source and destination. */
        const { repositoryRoot, destinationRoot, } = await sourceAndDestination({ fixturePath: fixture.path, branch: 'unstaged-topic', },);
        /** Interrupted transaction. */
        const transaction = await writeInterruptedInstallation({ repositoryRoot, destinationRoot, recordCreated: true, },);
        await chmod(join(transaction.stageContainer, 'payload', 'cache',), 0o700,);
        await rm(transaction.stageContainer, { recursive: true, force: true, },);

        /** Next unrelated command. */
        const result = requireSuccess(await captureWrapper({ cwd: repositoryRoot, args: ['status', '--short',], },),);

        expect(result.stderr,).toContain('because its private stage is missing',);
        expect(await journalNames(repositoryRoot,),).toEqual([],);
      },
    },),
  ],
},);
