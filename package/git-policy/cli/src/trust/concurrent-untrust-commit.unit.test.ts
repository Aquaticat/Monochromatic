/**
 A commit that overlaps a provenance transaction of another repository's `untrust`.

 `untrust` holds the registry-wide recursive-operation lock while its journal is live.
 A commit loads its trusted config without that lock,
 so it must wait for a live transaction owner and recover only a dead one,
 never failing because another process is mid-transaction.
 The live transaction is simulated deterministically:
 the test process holds the lock and publishes a journal naming itself,
 exactly the state a running `untrust` leaves between installing its journal and settling it.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { randomUUID, } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  createLandingRepository,
  finish,
  git,
  type LandingRepository,
  REAL_GIT,
  runWrapper,
  startWrapper,
  writeWorktreeFile,
} from '../policy-engine/commit-landing-fixture.unit.test.ts';

/** Registry internals from the built artifact. */
const {
  acquireRecursiveRegistryLock,
  recoverProvenanceTransactions,
} = internalTestExports;

/** Self-contained trusted config. */
const CONFIG_SOURCE = `export default { plugins: {} };
`;

/** Time the simulated `untrust` stays mid-transaction; a commit failing on the live journal exits well within it. */
const LIVE_TRANSACTION_MS = 2_000;

/** Private file mode the registry requires of a journal. */
const PRIVATE_FILE_MODE = 0o600;

/** Private directory mode the registry requires. */
const PRIVATE_DIRECTORY_MODE = 0o700;

/** Trust identity as stored in a record. */
type StoredIdentity = Readonly<{
  /** Encoded filesystem identity. */
  filesystemId: string;
  /** Canonical config path. */
  canonicalConfigPath: string;
}>;

/** Repository whose commits run against a registry that also trusts an unrelated repository. */
type UntrustFixture = Readonly<{
  /** Committing repository, trusted. */
  repository: LandingRepository;
  /** Registry root under the disposable account home. */
  registry: string;
  /** Identity of the unrelated trusted repository's record. */
  otherIdentity: StoredIdentity;
}>;

/**
 Lists every installed record file.

 @param registry - registry root

 @returns record paths relative to the records directory
 */
async function recordFiles(registry: string,): Promise<readonly string[]> {
  return (await readdir(join(registry, 'records',), { recursive: true, },))
    .filter(function isRecord(path,) {
      return path.endsWith('record.json',);
    },);
}

/**
 Finds the stored identity of the record whose repository root is given.

 @param registry - registry root

 @param repositoryRoot - canonical repository root

 @returns stored identity
 */
async function storedIdentity({
  registry,
  repositoryRoot,
}: Readonly<{
  registry: string;
  repositoryRoot: string;
}>,): Promise<StoredIdentity> {
  /** Every parsed record. */
  const records = await Promise.all((await recordFiles(registry,)).map(async function parseRecord(path,) {
    return JSON.parse(await readFile(join(registry, 'records', path,), 'utf8',),) as Readonly<{
      repositoryRoot: string;
      identity: StoredIdentity;
    }>;
  },),);
  /** The matching record. */
  const match = records.find(function matchesRoot(record,) {
    return record.repositoryRoot === repositoryRoot;
  },);
  if (match === undefined)
    throw new Error(`No trust record for ${repositoryRoot}`,);
  return match.identity;
}

/**
 Trusts the committing repository and an unrelated sibling repository in one disposable registry.

 @param repository - committing repository

 @returns fixture
 */
async function createUntrustFixture(repository: LandingRepository,): Promise<UntrustFixture> {
  await writeWorktreeFile({ repository, name: 'cli-git.config.mjs', content: CONFIG_SOURCE, },);
  await git({ repository, args: ['add', 'cli-git.config.mjs',], },);
  await git({ repository, args: ['commit', '--quiet', '-m', 'config',], },);
  expect((await runWrapper({ repository, args: ['cli-git', 'trust', '--yes',], },)).exitCode,).toBe(0,);
  /** Unrelated repository sharing the account registry. */
  const other = join(repository.scratch, 'other',);
  await nanoSpawn(REAL_GIT, ['init', '--quiet', other,], { env: repository.env, },);
  await writeFile(join(other, 'cli-git.config.mjs',), CONFIG_SOURCE,);
  expect((await runWrapper({ repository, args: ['-C', other, 'cli-git', 'trust', '--yes',], },)).exitCode,).toBe(0,);
  /** Registry root the preload derives from the disposable home. */
  const registry = join(repository.scratch, '.local', 'state', 'cli-git', 'trust', 'v1',);
  expect((await recordFiles(registry,)).length,).toBe(2,);
  return {
    repository,
    registry,
    otherIdentity: await storedIdentity({ registry, repositoryRoot: await realpath(other,), },),
  };
}

/**
 Publishes an untrust journal removing the unrelated record, as `untrust` does before settling it.

 @param registry - registry root

 @param ownerPid - process the journal names as its owner

 @param identity - record the untrust removes
 */
async function publishUntrustJournal({
  registry,
  ownerPid,
  identity,
}: Readonly<{
  registry: string;
  ownerPid: number;
  identity: StoredIdentity;
}>,): Promise<void> {
  /** Journal directory. */
  const directory = join(registry, 'transactions',);
  await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE, },);
  /** Transaction identifier. */
  const transactionId = randomUUID();
  await writeFile(
    join(directory, `${transactionId}.json`,),
    `${JSON.stringify({ schemaVersion: 1, ownerPid, transactionId, operations: [{ identity, action: 'remove', },], },)}\n`,
    { mode: PRIVATE_FILE_MODE, },
  );
}

/**
 Returns the PID of a process that has already exited.

 @returns exited process ID
 */
async function exitedPid(): Promise<number> {
  /** Short-lived process. */
  const child = spawn(process.execPath, ['--eval', '',], { stdio: 'ignore', },);
  /** Its PID, read before exit. */
  const { pid, } = child;
  await once(child, 'exit',);
  if (pid === undefined)
    throw new Error('exited process had no PID',);
  return pid;
}

await describe({
  name: 'commit overlapping another repository untrust',
  children: [
    it({
      name: 'waits for a live untrust transaction instead of failing, then commits once it settles',
      fn: async function testLiveUntrust(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Trusted repository pair. */
        const fixture = await createUntrustFixture(repository,);
        /** Live owner, as the running untrust holds the lock. */
        const holder = await acquireRecursiveRegistryLock({ registryRoot: fixture.registry, },);
        await publishUntrustJournal({
          registry: fixture.registry,
          ownerPid: process.pid,
          identity: fixture.otherIdentity,
        },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await git({ repository, args: ['add', 'a.txt',], },);
        /** Commit started while the untrust is mid-transaction. */
        const child = startWrapper({ repository, args: ['commit', '--quiet', '-m', 'during untrust', 'a.txt',], },);
        /** Its outcome, collected from the start. */
        const outcome = finish(child,);
        await wait(LIVE_TRANSACTION_MS,);
        /** Whether the commit already ended while the transaction was live. */
        const endedEarly = (child.exitCode !== null) || (child.signalCode !== null);
        // The simulated untrust finishes: it settles its own journal, then releases the lock.
        await recoverProvenanceTransactions({ registryRoot: fixture.registry, },);
        await holder[Symbol.asyncDispose]();
        /** Finished commit. */
        const result = await outcome;
        expect({ endedEarly, exitCode: result.exitCode, stderr: result.stderr, },).toEqual({
          endedEarly: false,
          exitCode: 0,
          stderr: '',
        },);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('during untrust',);
        expect((await recordFiles(fixture.registry,)).length,).toBe(1,);
        expect(await readdir(join(fixture.registry, 'transactions',),),).toEqual([],);
      },
    },),
    it({
      name: 'recovers a dead untrust transaction and commits',
      fn: async function testDeadUntrust(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Trusted repository pair. */
        const fixture = await createUntrustFixture(repository,);
        await publishUntrustJournal({
          registry: fixture.registry,
          ownerPid: await exitedPid(),
          identity: fixture.otherIdentity,
        },);
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'a\n', },);
        await git({ repository, args: ['add', 'a.txt',], },);
        /** Commit after the untrust died mid-transaction. */
        const result = await runWrapper({ repository, args: ['commit', '--quiet', '-m', 'after dead untrust', 'a.txt',], },);
        expect({ exitCode: result.exitCode, stderr: result.stderr, },).toEqual({ exitCode: 0, stderr: '', },);
        expect(await git({ repository, args: ['log', '-1', '--format=%s',], },),).toBe('after dead untrust',);
        expect((await recordFiles(fixture.registry,)).length,).toBe(1,);
        expect(await readdir(join(fixture.registry, 'transactions',),),).toEqual([],);
      },
    },),
  ],
},);
