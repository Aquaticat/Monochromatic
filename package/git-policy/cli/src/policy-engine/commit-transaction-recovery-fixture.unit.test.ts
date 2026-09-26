/**
 Disposable real-Git repositories and transaction states for recovery tests.

 Transactions are built by the shipped workspace and journal code,
 then their owner is rewritten to a dead or reused process to model a crash at an exact phase.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  copyFile,
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

/**
 Built transaction workspace shape.
 */
export type CommitTransactionWorkspace = internalTestExports.CommitTransactionWorkspace;

/**
 Built prepared journal shape.
 */
type PreparedTransactionJournal = internalTestExports.PreparedTransactionJournal;

const {
  createCommitTransactionWorkspace,
  OWNER_FILENAME,
  prepareTransactionJournal,
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
  TRANSACTION_ROOT_NAME,
} = internalTestExports;

/**
 Absolute real Git executable.
 */
export const REAL_GIT: string = await resolveRealGit();

/**
 Environment isolating fixture Git from host global and system configuration.
 */
const FIXTURE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'cli-git recovery fixture',
  GIT_AUTHOR_EMAIL: 'recovery@example.invalid',
  GIT_COMMITTER_NAME: 'cli-git recovery fixture',
  GIT_COMMITTER_EMAIL: 'recovery@example.invalid',
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

 @param env - extra environment entries

 @returns trimmed standard output

 @example
 ```ts
 await runFixtureGit({ repository: '/tmp/repo', args: ['rev-parse', 'HEAD'] });
 ```
 */
export async function runFixtureGit({
  repository,
  args,
  env = {},
}: Readonly<{
  repository: string;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
}>,): Promise<string> {
  /**
   Completed fixture Git process.
   */
  const result = await nanoSpawn(
    REAL_GIT,
    [...args,],
    {
      cwd: repository,
      env: {
        ...FIXTURE_ENV,
        ...env,
      },
    },
  );
  return result.stdout.trim();
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
  await runFixtureGit({
    repository: path,
    args: ['init', '--quiet', '--initial-branch=main',],
  },);
  await writeFile(
    join(
      path,
      'base.txt',
    ),
    'base\n',
  );
  await runFixtureGit({
    repository: path,
    args: ['add', 'base.txt',],
  },);
  await runFixtureGit({
    repository: path,
    args: ['commit', '--quiet', '--message=baseline',],
  },);
  /**
   Repository Git directory.
   */
  const gitDir = join(
    path,
    '.git',
  );
  return {
    path,
    registryRoot: join(
      gitDir,
      TRANSACTION_ROOT_NAME,
    ),
    legacyDirectory: join(
      gitDir,
      'cli-git-transaction',
    ),
    indexPath: join(
      gitDir,
      'index',
    ),
    lockPath: join(
      gitDir,
      'index.lock',
    ),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
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
  await writeFile(
    join(
      repository,
      name,
    ),
    content,
  );
  await runFixtureGit({
    repository,
    args: ['add', name,],
  },);
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
  return runFixtureGit({
    repository,
    args: ['rev-parse', 'HEAD',],
  },);
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
  const child = spawn(
    process.execPath,
    ['--eval', 'setInterval(() => {}, 1000);',],
    { stdio: 'ignore', },
  );
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
  const exited = once(
    child,
    'exit',
  );
  child.kill('SIGKILL',);
  await exited;
  return {
    ownerPid: pid,
    ownerIdentity,
  };
}

/**
 Opens a real transaction workspace, which holds the real index lock and publishes its directory.

 @param repository - repository root

 @returns live workspace owned by the test process

 @example
 ```ts
 const workspace = await openTransaction('/tmp/repo');
 ```
 */
export function openTransaction(repository: string,): Promise<CommitTransactionWorkspace> {
  return createCommitTransactionWorkspace({
    gitPath: REAL_GIT,
    cwd: repository,
  },);
}

/**
 Snapshots the real index and writes the prepared journal of an index-mode commit.

 @param repository - repository root

 @param workspace - open workspace

 @returns durable prepared journal

 @example
 ```ts
 await journalTransaction({ repository, workspace });
 ```
 */
export async function journalTransaction({
  repository,
  workspace,
}: Readonly<{
  repository: string;
  workspace: CommitTransactionWorkspace;
}>,): Promise<PreparedTransactionJournal> {
  await copyFile(
    workspace.realIndexPath,
    workspace.originalIndexPath,
  );
  await copyFile(
    workspace.realIndexPath,
    workspace.commitIndexPath,
  );
  /**
   Tree the commit would record.
   */
  const intendedTreeOid = await runFixtureGit({
    repository,
    args: ['write-tree',],
    env: { GIT_INDEX_FILE: workspace.commitIndexPath, },
  },);
  await copyFile(
    workspace.commitIndexPath,
    workspace.postIndexPath,
  );
  return prepareTransactionJournal({
    workspace,
    gitPath: REAL_GIT,
    cwd: repository,
    mode: 'index',
    amend: false,
    selectedPaths: [],
    addedPaths: [],
    intendedTreeOid,
  },);
}

/**
 Lands the prepared commit the way the transaction does: private index plus nonce-bearing reflog action.

 @param repository - repository root

 @param workspace - journaled workspace

 @param message - commit message

 @returns landed commit OID

 @example
 ```ts
 await landTransaction({ repository, workspace, message: 'landed' });
 ```
 */
export async function landTransaction({
  repository,
  workspace,
  message,
}: Readonly<{
  repository: string;
  workspace: CommitTransactionWorkspace;
  message: string;
}>,): Promise<string> {
  await runFixtureGit({
    repository,
    args: ['commit', '--quiet', `--message=${message}`,],
    env: {
      GIT_INDEX_FILE: workspace.commitIndexPath,
      GIT_REFLOG_ACTION: workspace.reflogAction,
    },
  },);
  return headOid(repository,);
}

/**
 Closes the workspace descriptor while keeping its directory and lock, as a crash would.

 @param workspace - open workspace

 @example
 ```ts
 await abandonTransaction(workspace);
 ```
 */
export async function abandonTransaction(workspace: CommitTransactionWorkspace,): Promise<void> {
  workspace.preserveForRecovery();
  await workspace[Symbol.asyncDispose]();
}

/**
 Rewrites a JSON record in place, keeping its inode.

 @param path - JSON record path

 @param fields - replaced fields

 @example
 ```ts
 await rewriteJsonRecord({ path: '/tmp/repo/.git/cli-git-transactions/id/journal.json', fields: { ownerIdentity: 'linux:0' } });
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
  const current: unknown = JSON.parse(await readFile(
    path,
    'utf8',
  ),);
  if (((typeof current) !== 'object') || (current === null))
    throw new Error(`Fixture record is not an object: ${path}`,);
  await writeFile(
    path,
    `${JSON.stringify({
      ...current,
      ...fields,
    },)}\n`,
  );
}

/**
 Reassigns a transaction to another owner and creation time in its owner record and journal.

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
    path: join(
      directory,
      OWNER_FILENAME,
    ),
    fields: {
      ...owner,
      createdAt,
    },
  },);
  /**
   Journal present only after preparation.
   */
  const entries = await readdir(directory,);
  if (entries.includes('journal.json',))
    await rewriteJsonRecord({
      path: join(
        directory,
        'journal.json',
      ),
      fields: owner,
    },);
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
export async function registryEntries(registryRoot: string,): Promise<readonly string[]> {
  try {
    return (await readdir(registryRoot,)).toSorted();
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
}
