/**
 Disposable real-Git repositories, owner identities, and leftover listings for recovery tests.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { resolveRealGit, } from '@monochromatic-dev/git-executable/ts';
import nanoSpawn from 'nano-spawn';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  OWNER_FILENAME,
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
  TRANSACTION_ROOT_NAME,
} = internalTestExports;

/**
 Absolute real Git executable.
 */
export const REAL_GIT: string = await resolveRealGit();

/**
 Repository-local configuration pinning identity and signing,
 because native preparation inherits this process's environment and the host's global configuration.
 */
const LOCAL_CONFIG: readonly (readonly [string, string])[] = [
  ['user.name', 'cli-git recovery fixture',],
  ['user.email', 'recovery@example.invalid',],
  ['commit.gpgSign', 'false',],
];

/**
 Environment isolating fixture Git from host global and system configuration.
 */
const FIXTURE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_EDITOR: ':',
};

/**
 Disposable repository with its administrative paths.
 */
export type RecoveryRepository = Readonly<{
  /**
   Worktree root.
   */
  path: string;
  /**
   Git directory.
   */
  gitDir: string;
  /**
   Per-transaction registry.
   */
  registryRoot: string;
  /**
   Legacy single-journal directory.
   */
  legacyDirectory: string;
  /**
   Real index.
   */
  indexPath: string;
  /**
   Real index lock.
   */
  lockPath: string;
  /**
   Removes the repository.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Process identity recorded as a transaction owner.
 */
export type OwnerIdentity = Readonly<{
  /**
   Recorded PID.
   */
  ownerPid: number;
  /**
   Recorded process-birth identity.
   */
  ownerIdentity: string;
}>;

/**
 Runs fixture Git with isolated configuration.

 @param repository - repository root

 @param args - Git arguments

 @returns trimmed standard output

 @example
 ```ts
 await runFixtureGit({ repository: '/tmp/repo', args: ['rev-parse', 'HEAD'] });
 ```
 */
export async function runFixtureGit({
  repository,
  args,
}: Readonly<{
  repository: string;
  args: readonly string[];
}>,): Promise<string> {
  return (await nanoSpawn(
    REAL_GIT,
    [...args,],
    {
      cwd: repository,
      env: FIXTURE_ENV,
    },
  )).stdout.trim();
}

/**
 Creates a repository with one baseline commit.

 @returns disposable repository

 @example
 ```ts
 await using repository = await createRecoveryRepository();
 ```
 */
export async function createRecoveryRepository(): Promise<RecoveryRepository> {
  /**
   Repository root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'cli-git-recovery-',
  ),);
  await runFixtureGit({ repository: path, args: ['init', '--quiet', '--initial-branch=main',], },);
  for (const [key, value,] of LOCAL_CONFIG) {
    // oxlint-disable-next-line no-await-in-loop -- Config writes to one file are ordered.
    await runFixtureGit({ repository: path, args: ['config', key, value,], },);
  }
  await writeFile(join(path, 'base.txt',), 'base\n',);
  await runFixtureGit({ repository: path, args: ['add', 'base.txt',], },);
  await runFixtureGit({ repository: path, args: ['commit', '--quiet', '--message=baseline',], },);
  /**
   Repository Git directory.
   */
  const gitDir = join(path, '.git',);
  return {
    path,
    gitDir,
    registryRoot: join(gitDir, TRANSACTION_ROOT_NAME,),
    legacyDirectory: join(gitDir, 'cli-git-transaction',),
    indexPath: join(gitDir, 'index',),
    lockPath: join(gitDir, 'index.lock',),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Writes and stages one file in the real index.

 @param repository - repository root

 @param name - repository-relative file name

 @param content - file content

 @example
 ```ts
 await stageFile({ repository, name: 'a.txt', content: 'a\n' });
 ```
 */
export async function stageFile({
  repository,
  name,
  content,
}: Readonly<{
  repository: string;
  name: string;
  content: string;
}>,): Promise<void> {
  await writeFile(join(repository, name,), content,);
  await runFixtureGit({ repository, args: ['add', name,], },);
}

/**
 Resolves the current commit.

 @param repository - repository root

 @returns HEAD commit OID

 @example
 ```ts
 await headOid('/tmp/repo');
 ```
 */
export function headOid(repository: string,): Promise<string> {
  return runFixtureGit({ repository, args: ['rev-parse', 'HEAD',], },);
}

/**
 Captures the identity of a child process that has exited.

 @returns PID and birth identity no running process matches

 @example
 ```ts
 const dead = await exitedProcessIdentity();
 ```
 */
export async function exitedProcessIdentity(): Promise<OwnerIdentity> {
  /**
   Short-lived owner stand-in kept alive until its identity is read.
   */
  const child = spawn(process.execPath, ['--eval', 'setInterval(() => {}, 1000);',], { stdio: 'ignore', },);
  /**
   Child PID assigned at spawn.
   */
  const { pid, } = child;
  if (pid === undefined)
    throw new Error('Owner stand-in process did not start.',);
  /**
   Birth identity while the child still runs.
   */
  const ownerIdentity = await resolveProcessBirthIdentity(pid,);
  if ((typeof ownerIdentity) === 'symbol')
    throw new Error(`Owner stand-in identity was unavailable: ${String(ownerIdentity === PROCESS_IDENTITY_ABSENT,)}`,);
  /**
   Exit notification registered before signalling.
   */
  const exited = once(child, 'exit',);
  child.kill('SIGKILL',);
  await exited;
  return { ownerPid: pid, ownerIdentity, };
}

/**
 Rewrites a JSON record in place.

 @param path - JSON record path

 @param fields - replaced fields

 @example
 ```ts
 await rewriteJsonRecord({ path: '/tmp/repo/.git/cli-git-transactions/id/owner.json', fields: { ownerIdentity: 'linux:0' } });
 ```
 */
export async function rewriteJsonRecord({
  path,
  fields,
}: Readonly<{
  path: string;
  fields: Readonly<Record<string, unknown>>;
}>,): Promise<void> {
  /**
   Current record fields.
   */
  const current: unknown = JSON.parse(await readFile(path, 'utf8',),);
  if (((typeof current) !== 'object') || (current === null))
    throw new Error(`Fixture record is not an object: ${path}`,);
  await writeFile(path, `${JSON.stringify({ ...current, ...fields, },)}\n`,);
}

/**
 Reassigns a transaction to another owner and creation time.

 @param directory - transaction directory

 @param owner - replacement owner identity

 @param createdAt - replacement ISO creation time ordering recovery

 @example
 ```ts
 await reassignOwner({ directory, owner: await exitedProcessIdentity(), createdAt: '2026-01-01T00:00:00.000Z' });
 ```
 */
export async function reassignOwner({
  directory,
  owner,
  createdAt,
}: Readonly<{
  directory: string;
  owner: OwnerIdentity;
  createdAt: string;
}>,): Promise<void> {
  await rewriteJsonRecord({
    path: join(directory, OWNER_FILENAME,),
    fields: { ...owner, createdAt, },
  },);
}

/**
 Lists directory entries.

 @param directory - directory

 @returns sorted entry names; empty when the directory is absent
 */
async function entries(directory: string,): Promise<readonly string[]> {
  try {
    return (await readdir(directory,)).toSorted();
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
}

/**
 Lists registry entry names.

 @param registryRoot - per-transaction registry

 @returns sorted entry names; empty when the registry is absent

 @example
 ```ts
 await registryEntries('/tmp/repo/.git/cli-git-transactions');
 ```
 */
export function registryEntries(registryRoot: string,): Promise<readonly string[]> {
  return entries(registryRoot,);
}

/**
 Lists what a finished recovery must not leave: shadows, `.keep` files, registry entries, and top-level locks.

 @param repository - disposable repository

 @returns leftover names

 @example
 ```ts
 await recoveryLeftovers(repository); // []
 ```
 */
export async function recoveryLeftovers(repository: RecoveryRepository,): Promise<readonly string[]> {
  /**
   Candidate locations.
   */
  const [shadows, packs, transactions, top,] = await Promise.all([
    entries(join(repository.gitDir, 'cli-git', 'shadow',),),
    entries(join(repository.gitDir, 'objects', 'pack',),),
    entries(repository.registryRoot,),
    entries(repository.gitDir,),
  ],);
  return [
    ...shadows.map(function shadowName(name,): string {
      return `shadow/${name}`;
    },),
    ...packs.filter(function isKeep(name,): boolean {
      return name.endsWith('.keep',);
    },),
    ...transactions,
    ...top.filter(function isLock(name,): boolean {
      return name.endsWith('.lock',);
    },),
  ];
}
