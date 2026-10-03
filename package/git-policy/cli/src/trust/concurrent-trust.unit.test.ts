/**
 Concurrent explicit trust against one account registry.

 Every `git cli-git trust --yes` takes the registry-wide recursive-operation lock,
 so concurrent invocations for different repositories must queue behind a live owner
 instead of failing after a fixed retry budget.
 A registry holding many records keeps each owner in the lock long enough to exhaust such a budget;
 the test reproduces that deterministically by holding the lock from the test process first.

 @module
 */
import {
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

/** Registry lock from the built artifact. */
const { acquireRecursiveRegistryLock, } = internalTestExports;
/** Real Git binary for disposable repositories. */
const REAL_GIT = await resolveGit();
/** Internal management subprocess runner with an injected registry root. */
const RUNNER = join(import.meta.dirname, 'fixture', 'management-runner.ts',);
/** Concurrent trust invocations; 9 of 16 failed against the fixed 1-second lock budget. */
const INVOCATIONS = 16;
/** Time a live owner holds the lock while every invocation waits, longer than any fixed acquisition budget. */
const LIVE_OWNER_HOLD_MS = 3_000;
/** Self-contained trusted config. */
const CONFIG_SOURCE = `export default { plugins: {} };
`;

/** Disposable account home holding one registry and every repository. */
type ConcurrentTrustFixture = Readonly<{
  /** Registry root at its account-derived location under the disposable home. */
  registry: string;
  /** Repository roots, one per invocation. */
  repositories: readonly string[];
  /** Removes the disposable home. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/** Outcome of one trust invocation. */
type TrustOutcome = Readonly<{
  /** Repository the invocation trusted. */
  repository: string;
  /** Process exit code. */
  exitCode: number;
  /** Captured stdout. */
  stdout: string;
}>;

/**
 Creates a repository with a root config.

 @param repository - repository root to create

 @example
 ```ts
 await createRepository('/tmp/home/repo-0');
 ```
 */
async function createRepository(repository: string,): Promise<void> {
  await mkdir(repository,);
  await nanoSpawn(REAL_GIT, ['init', '--quiet',], { cwd: repository, },);
  await writeFile(join(repository, 'cli-git.config.mjs',), CONFIG_SOURCE,);
}

/**
 Creates a disposable home with one registry and one repository per invocation.

 @returns disposable fixture

 @example
 ```ts
 await using fixture = await createFixture();
 ```
 */
async function createFixture(): Promise<ConcurrentTrustFixture> {
  /** Created disposable home. */
  const created = await mkdtemp(join(tmpdir(), 'cli-git-concurrent-trust-',),);
  /** Canonical disposable home. */
  const home = await realpath(created,);
  /** Repository roots. */
  const repositories = Array.from({ length: INVOCATIONS, }, function repositoryPath(_unused, index,) {
    return join(home, `repo-${String(index,)}`,);
  },);
  await Promise.all(repositories.map(createRepository,),);
  return {
    registry: join(home, '.local', 'state', 'cli-git', 'trust', 'v1',),
    repositories,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(home, { recursive: true, force: true, },);
    },
  };
}

/**
 Runs one `trust --yes` without throwing on a nonzero exit.

 @param registry - shared registry root

 @param repository - repository to trust

 @returns invocation outcome
 */
async function trustRepository({
  registry,
  repository,
}: Readonly<{
  registry: string;
  repository: string;
}>,): Promise<TrustOutcome> {
  try {
    /** Successful invocation. */
    const result = await nanoSpawn('node', [RUNNER, registry, repository, 'trust', '--yes',],);
    return { repository, exitCode: 0, stdout: result.stdout, };
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('exitCode' in error) && ((typeof error.exitCode) === 'number')
      && ('stdout' in error) && ((typeof error.stdout) === 'string'))
      return { repository, exitCode: error.exitCode, stdout: error.stdout, };
    throw error;
  }
}

await describe({
  name: 'concurrent explicit trust',
  children: [
    it({
      name: `${String(INVOCATIONS,)} concurrent trust --yes invocations against one registry all install their record`,
      fn: async function testConcurrentTrust(): Promise<void> {
        await using fixture = await createFixture();
        /** Live owner the invocations queue behind. */
        const holder = await acquireRecursiveRegistryLock({ registryRoot: fixture.registry, },);
        /** Every invocation's pending outcome. */
        const pending = Promise.all(fixture.repositories.map(function trustOne(repository,) {
          return trustRepository({ registry: fixture.registry, repository, },);
        },),);
        await wait(LIVE_OWNER_HOLD_MS,);
        await holder[Symbol.asyncDispose]();
        /** Every invocation's outcome. */
        const outcomes = await pending;
        expect(outcomes.filter(function failed(outcome,) {
          return outcome.exitCode !== 0;
        },),).toEqual([],);
        /** Registry root entries after every invocation exited. */
        const rootEntries = await readdir(fixture.registry,);
        expect(rootEntries.filter(function isLockEntry(name,) {
          return name.startsWith('recursive-operation.lock',);
        },),).toEqual([],);
        /** Installed record files. */
        const records = (await readdir(join(fixture.registry, 'records',), { recursive: true, },))
          .filter(function isRecord(path,) {
            return path.endsWith('record.json',);
          },);
        expect(records.length,).toBe(INVOCATIONS,);
      },
    },),
  ],
},);
