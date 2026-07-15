/**
 * Disposable and recoverable private-index transaction workspace.
 *
 * @module
 */
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import { randomUUID, } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
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
  DIRECTORY_MODE,
  protectPath,
  syncDirectory,
} from '../trust/registry-io.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';

/**
 * Private file mode restricted to current account.
 */
const PRIVATE_FILE_MODE = 0o600;
/**
 * Stable per-index transaction directory name.
 */
export const TRANSACTION_DIRECTORY_NAME = 'cli-git-transaction';

/**
 * Owned private transaction state.
 */
export type CommitTransactionWorkspace = {
  /**
   * Durable transaction directory outside worktree content.
   */
  readonly directory: string;
  /**
   * Private commit index.
   */
  readonly commitIndexPath: string;
  /**
   * Prepared post-commit index.
   */
  readonly postIndexPath: string;
  /**
   * Exact original index snapshot.
   */
  readonly originalIndexPath: string;
  /**
   * Durable transaction journal.
   */
  readonly journalPath: string;
  /**
   * Private nonce-bearing reflog action for post-crash attribution.
   */
  readonly reflogAction: string;
  /**
   * Real index path.
   */
  readonly realIndexPath: string;
  /**
   * Real Git lock path.
   */
  readonly lockPath: string;
  /**
   * Filesystem identity of owned lock.
   */
  readonly lockFsId: string;
  /**
   * Device identity of owned lock object.
   */
  readonly lockDevice: string;
  /**
   * Inode identity of owned lock object.
   */
  readonly lockInode: string;
  /**
   * Marks ref advancement so disposal preserves recovery artifacts.
   */
  readonly preserveForRecovery: () => void;
  /**
   * Marks durable completion so disposal removes recovery artifacts.
   */
  readonly finishTransaction: () => void;
  /**
   * Atomically installs private index through held Git lock.
   */
  readonly installIndex: (sourcePath: string) => Promise<void>;
  /**
   * Removes private state unless recovery owns it.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Resolves absolute Git-provided path.
 *
 * @param cwd - effective repository directory
 *
 * @param reportedPath - Git path output
 *
 * @returns absolute native path
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
 * Revalidates exact owned lock name before path-based replacement.
 *
 * @param lockPath - owned lock pathname
 *
 * @param lockFsId - original filesystem identity
 *
 * @param lockDevice - original device identity
 *
 * @param lockInode - original inode identity
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
   * Current non-followed lock metadata.
   */
  const metadata = await lstat(
    lockPath,
    { bigint: true, },
  );
  /**
   * Current lock filesystem identity.
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
 * Creates durable private directory and acquires exclusive real-index lock.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @returns owned disposable workspace
 *
 * @example
 * ```ts
 * await createCommitTransactionWorkspace({ gitPath: '/usr/bin/git', cwd: '/repo' });
 * ```
 */
export async function createCommitTransactionWorkspace({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<CommitTransactionWorkspace> {
  /**
   * Git-provided real index and transaction paths.
   */
  const [indexOutput, directoryOutput,] = await Promise.all([
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
        TRANSACTION_DIRECTORY_NAME,
      ],
    },),
  ],);
  /**
   * Strict administrative path decoder.
   */
  const decoder = new TextDecoder(
    'utf-8',
    { fatal: true, },
  );
  /**
   * Absolute real index path.
   */
  const realIndexPath = resolveGitPath({
    cwd,
    reportedPath: decoder.decode(indexOutput.stdout,)
      .trim(),
  },);
  /**
   * Absolute durable transaction directory.
   */
  const directory = resolveGitPath({
    cwd,
    reportedPath: decoder.decode(directoryOutput.stdout,)
      .trim(),
  },);
  /**
   * Canonical administrative parent proving no transaction symlink.
   */
  const canonicalParent = await realpath(dirname(directory,),);
  if (resolve(
    canonicalParent,
    TRANSACTION_DIRECTORY_NAME,
  ) !== resolve(directory,))
    throw new TypeError('Git transaction path has a noncanonical administrative parent.',);
  await mkdir(
    directory,
    { mode: DIRECTORY_MODE, },
  );
  await protectPath({
    path: directory,
    directory: true,
  },);
  await syncDirectory(canonicalParent,);
  /**
   * Real Git lock path.
   */
  const lockPath = `${realIndexPath}.lock`;
  /**
   * Exclusive real-index lock.
   */
  const lockHandle = await open(
    lockPath,
    'wx',
    PRIVATE_FILE_MODE,
  );
  await protectPath({
    path: lockPath,
    directory: false,
  },);
  /**
   * Filesystem identity containing owned lock artifact.
   */
  const lockFilesystem = await resolveFsId({
    path: lockPath,
    emitDiagnostics: false,
  },);
  /**
   * Exact owned lock object metadata.
   */
  const lockMetadata = await lockHandle.stat({ bigint: true, },);
  /**
   * Installation marker populated only after atomic replacement.
   */
  const installed = new Set<'installed'>();
  /**
   * Recovery marker populated immediately after real Git advances ref.
   */
  const preserved = new Set<'preserved'>();
  /**
   * Closed-handle marker preventing duplicate close after partial installation.
   */
  const closed = new Set<'closed'>();
  return {
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
    reflogAction: `cli-git:transaction:${randomUUID()}`,
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
       * Exact intended index bytes.
       */
      const bytes = await readFile(sourcePath,);
      await assertWorkspaceLockIdentity({
        lockPath,
        lockFsId: lockFilesystem.value,
        lockDevice: String(lockMetadata.dev,),
        lockInode: String(lockMetadata.ino,),
      },);
      await lockHandle.writeFile(bytes,);
      await lockHandle.sync();
      await assertWorkspaceLockIdentity({
        lockPath,
        lockFsId: lockFilesystem.value,
        lockDevice: String(lockMetadata.dev,),
        lockInode: String(lockMetadata.ino,),
      },);
      /**
       * Private owner-preserving installation name.
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
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
      await syncDirectory(canonicalParent,);
    },
  };
}
