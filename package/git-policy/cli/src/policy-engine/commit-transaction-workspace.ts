/**
 Disposable and recoverable private-index transaction workspace.
 
 @module
 */
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import { randomUUID, } from 'node:crypto';
import {
  lstat,
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import {
  isMissingPath,
  protectPath,
  syncDirectory,
} from '../trust/registry-io.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';
import {
  createTransactionOwnerRecord,
  encodeTransactionOwner,
} from './commit-transaction-owner.ts';
import {
  ensureTransactionRoot,
  publishTransactionDirectory,
  removeTransactionDirectory,
  TRANSACTION_ROOT_NAME,
} from './commit-transaction-registry.ts';
import { applyIndexTimestamps, } from './index-file-timestamps.ts';

/**
 Private file mode restricted to current account.
 */
const PRIVATE_FILE_MODE = 0o600;
/**
 Reflog action prefix whose suffix is the transaction ID, identifying the transaction's ref movement after a crash.
 */
export const TRANSACTION_REFLOG_ACTION_PREFIX = 'cli-git:transaction:';

/**
 Owned private transaction state.
 */
export type CommitTransactionWorkspace = {
  /**
   Unique transaction ID naming the durable directory.
   */
  readonly transactionId: string;
  /**
   Durable transaction directory outside worktree content.
   */
  readonly directory: string;
  /**
   Private commit index.
   */
  readonly commitIndexPath: string;
  /**
   Prepared post-commit index.
   */
  readonly postIndexPath: string;
  /**
   Exact original index snapshot.
   */
  readonly originalIndexPath: string;
  /**
   Durable transaction journal.
   */
  readonly journalPath: string;
  /**
   Private nonce-bearing reflog action for post-crash attribution.
   */
  readonly reflogAction: string;
  /**
   Real index path.
   */
  readonly realIndexPath: string;
  /**
   Real Git lock path.
   */
  readonly lockPath: string;
  /**
   Filesystem identity of owned lock.
   */
  readonly lockFsId: string;
  /**
   Device identity of owned lock object.
   */
  readonly lockDevice: string;
  /**
   Inode identity of owned lock object.
   */
  readonly lockInode: string;
  /**
   Marks ref advancement so disposal preserves recovery artifacts.
   */
  readonly preserveForRecovery: () => void;
  /**
   Marks durable completion so disposal removes recovery artifacts.
   */
  readonly finishTransaction: () => void;
  /**
   Atomically installs private index through held Git lock.
   */
  readonly installIndex: (sourcePath: string) => Promise<void>;
  /**
   Removes private state unless recovery owns it.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 Resolves absolute Git-provided path.
 
 @param cwd - effective repository directory
 
 @param reportedPath - Git path output
 
 @returns absolute native path
 */
function resolveGitPath({
  cwd,
  reportedPath,
}: Readonly<{
  cwd: string;
  reportedPath: string;
}>,): string {
  if (reportedPath.length === 0)
    throw new TypeError('Git returned an empty administrative path.',);
  return isAbsolute(reportedPath,) ? reportedPath : resolve(
    cwd,
    reportedPath,
  );
}

/**
 Revalidates exact owned lock name before path-based replacement.
 
 @param lockPath - owned lock pathname
 
 @param lockFsId - original filesystem identity
 
 @param lockDevice - original device identity
 
 @param lockInode - original inode identity
 */
async function assertWorkspaceLockIdentity({
  lockPath,
  lockFsId,
  lockDevice,
  lockInode,
}: Readonly<{
  lockPath: string;
  lockFsId: string;
  lockDevice: string;
  lockInode: string;
}>,): Promise<void> {
  /**
   Current non-followed lock metadata.
   */
  const metadata = await lstat(
    lockPath,
    { bigint: true, },
  );
  /**
   Current lock filesystem identity.
   */
  const filesystem = await resolveFsId({
    path: lockPath,
    emitDiagnostics: false,
  },);
  if ((!metadata.isFile())
    || metadata.isSymbolicLink()
    || (filesystem.value !== lockFsId)
    || (String(metadata.dev,) !== lockDevice)
    || (String(metadata.ino,) !== lockInode))
    throw new TypeError(`Commit transaction index lock identity changed: ${lockPath}`,);
}

/**
 Creates durable private directory and acquires exclusive real-index lock.
 
 @param gitPath - resolved Git executable
 
 @param cwd - effective repository directory
 
 @returns owned disposable workspace
 
 @example
 ```ts
 await createCommitTransactionWorkspace({ gitPath: '/usr/bin/git', cwd: '/repo' });
 ```
 */
export async function createCommitTransactionWorkspace({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<CommitTransactionWorkspace> {
  /**
   Git-provided real index and transaction registry paths.
   */
  const [indexOutput, rootOutput,] = await Promise.all([
    runTransactionGit({
      gitPath,
      cwd,
      args: [
        'rev-parse',
        '--git-path',
        'index',
      ],
    },),
    runTransactionGit({
      gitPath,
      cwd,
      args: [
        'rev-parse',
        '--git-path',
        TRANSACTION_ROOT_NAME,
      ],
    },),
  ],);
  /**
   Strict administrative path decoder.
   */
  const decoder = new TextDecoder(
    'utf-8',
    { fatal: true, },
  );
  /**
   Absolute real index path.
   */
  const realIndexPath = resolveGitPath({
    cwd,
    reportedPath: decoder.decode(indexOutput.stdout,)
      .trim(),
  },);
  /**
   Absolute per-worktree transaction registry.
   */
  const root = resolveGitPath({
    cwd,
    reportedPath: decoder.decode(rootOutput.stdout,)
      .trim(),
  },);
  await ensureTransactionRoot(root,);
  /**
   Real Git lock path.
   */
  const lockPath = `${realIndexPath}.lock`;
  /**
   Exclusive real-index lock acquired before creating any recovery state.
   */
  const lockHandle = await open(
    lockPath,
    'wx',
    PRIVATE_FILE_MODE,
  );
  /**
   Whether ownership has transferred to the returned workspace.
   */
  const ready = new Set<'ready'>();
  /**
   Closes an acquired descriptor even when setup fails before metadata is read.
   */
  await using setupHandle = {
    [Symbol.asyncDispose]: async function closeFailedSetupHandle(): Promise<void> {
      if (ready.size === 0)
        await lockHandle.close();
    },
  };
  /**
   Published directory this invocation can remove while still holding its lock.
   */
  const published: string[] = [];
  /**
   Releases only setup artifacts owned by this invocation on any pre-return failure.
   */
  await using setup = {
    [Symbol.asyncDispose]: async function disposeFailedSetup(): Promise<void> {
      if (ready.size > 0)
        return;
      await Promise.all(published.map(function removePublished(directory,): Promise<void> {
        return removeTransactionDirectory(directory,);
      },),);
      try {
        /**
         Current lock metadata, never followed across a replaced path.
         */
        const current = await lstat(
          lockPath,
          { bigint: true, },
        );
        /**
         Owned lock metadata from still-open descriptor.
         */
        const owned = await lockHandle.stat({ bigint: true, },);
        if ((current.dev === owned.dev) && (current.ino === owned.ino))
          await rm(lockPath,);
      }
      catch (error: unknown) {
        if (!isMissingPath(error,))
          throw error;
      }
    },
  };
  /**
   Exact owned lock object metadata.
   */
  const lockMetadata = await lockHandle.stat({ bigint: true, },);
  await protectPath({
    path: lockPath,
    directory: false,
  },);
  /**
   Filesystem identity containing owned lock artifact.
   */
  const lockFilesystem = await resolveFsId({
    path: lockPath,
    emitDiagnostics: false,
  },);
  /**
   Fresh transaction ID naming the directory and the reflog nonce.
   */
  const transactionId = randomUUID();
  /**
   Owner record published with the directory so recovery can skip this live transaction.
   */
  const owner = await createTransactionOwnerRecord({
    transactionId,
    realIndexPath,
    lockFsId: lockFilesystem.value,
    lockDevice: String(lockMetadata.dev,),
    lockInode: String(lockMetadata.ino,),
  },);
  /**
   Published durable transaction directory.
   */
  const directory = await publishTransactionDirectory({
    root,
    transactionId,
    ownerBytes: encodeTransactionOwner(owner,),
  },);
  published.push(directory,);
  /**
   Installation marker populated only after atomic replacement.
   */
  const installed = new Set<'installed'>();
  /**
   Recovery marker populated immediately after real Git advances ref.
   */
  const preserved = new Set<'preserved'>();
  /**
   Closed-handle marker preventing duplicate close after partial installation.
   */
  const closed = new Set<'closed'>();
  ready.add('ready',);
  return {
    transactionId,
    directory,
    commitIndexPath: join(
      directory,
      'commit.index',
    ),
    postIndexPath: join(
      directory,
      'post.index',
    ),
    originalIndexPath: join(
      directory,
      'original.index',
    ),
    journalPath: join(
      directory,
      'journal.json',
    ),
    reflogAction: `${TRANSACTION_REFLOG_ACTION_PREFIX}${transactionId}`,
    realIndexPath,
    lockPath,
    lockFsId: lockFilesystem.value,
    lockDevice: String(lockMetadata.dev,),
    lockInode: String(lockMetadata.ino,),
    preserveForRecovery: function preserveForRecovery(): void {
      preserved.add('preserved',);
    },
    finishTransaction: function finishTransaction(): void {
      preserved.delete('preserved',);
    },
    installIndex: async function installIndex(sourcePath: string,): Promise<void> {
      /**
       Exact intended index bytes.
       */
      const bytes = await readFile(sourcePath,);
      await assertWorkspaceLockIdentity({
        lockPath,
        lockFsId: lockFilesystem.value,
        lockDevice: String(lockMetadata.dev,),
        lockInode: String(lockMetadata.ino,),
      },);
      await lockHandle.writeFile(bytes,);
      await applyIndexTimestamps({
        sourcePath,
        handle: lockHandle,
      },);
      await lockHandle.sync();
      await assertWorkspaceLockIdentity({
        lockPath,
        lockFsId: lockFilesystem.value,
        lockDevice: String(lockMetadata.dev,),
        lockInode: String(lockMetadata.ino,),
      },);
      /**
       Private owner-preserving installation name.
       */
      const installPath = join(
        directory,
        'install.index',
      );
      await createOwnedFileLink({
        sourcePath: lockPath,
        linkedPath: installPath,
        expectedDevice: String(lockMetadata.dev,),
        expectedInode: String(lockMetadata.ino,),
      },);
      await lockHandle.close();
      closed.add('closed',);
      await rename(
        installPath,
        realIndexPath,
      );
      installed.add('installed',);
      await assertWorkspaceLockIdentity({
        lockPath,
        lockFsId: lockFilesystem.value,
        lockDevice: String(lockMetadata.dev,),
        lockInode: String(lockMetadata.ino,),
      },);
      await rm(lockPath,);
      await syncDirectory(dirname(realIndexPath,),);
    },
    [Symbol.asyncDispose]: async function disposeWorkspace(): Promise<void> {
      if ((closed.size === 0) && (installed.size === 0)) {
        await lockHandle.close();
        closed.add('closed',);
      }
      if (preserved.size > 0)
        return;
      if (installed.size === 0)
        await rm(
          lockPath,
          { force: true, },
        );
      await removeTransactionDirectory(directory,);
    },
  };
}
