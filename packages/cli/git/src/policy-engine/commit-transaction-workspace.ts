/**
 * Disposable private-index transaction workspace.
 *
 * @module
 */
import {
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { runTransactionGit, } from './commit-transaction-git.ts';

/**
 * Private transaction directory prefix.
 */
const TRANSACTION_PREFIX = join(
  tmpdir(),
  'cli-git-commit-',
);
/**
 * Private file mode restricted to current account.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 * Owned private transaction state.
 */
export type CommitTransactionWorkspace = Readonly<{
  /**
   * Temporary directory.
   */
  directory: string;
  /**
   * Private commit index.
   */
  commitIndexPath: string;
  /**
   * Private post-commit index.
   */
  postIndexPath: string;
  /**
   * Real index path.
   */
  realIndexPath: string;
  /**
   * Atomically installs private index through held Git lock.
   */
  installIndex: (sourcePath: string) => Promise<void>;
  /**
   * Removes private state and uninstalled lock.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates private directory and acquires exclusive real-index lock.
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
   * Git-provided index path.
   */
  const indexOutput = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--git-path',
      'index',
    ],
  },);
  /**
   * Decoded index path.
   */
  const reportedPath = new TextDecoder(
    'utf-8',
    { fatal: true, },
  )
    .decode(indexOutput.stdout,)
    .trim();
  if (reportedPath.length === 0)
    throw new TypeError('Git returned an empty index path.',);
  /**
   * Absolute real index path.
   */
  const realIndexPath = isAbsolute(reportedPath,)
    ? reportedPath
    : resolve(
      cwd,
      reportedPath,
    );
  /**
   * Real Git lock path.
   */
  const lockPath = `${realIndexPath}.lock`;
  /**
   * Private transaction directory.
   */
  const directory = await mkdtemp(TRANSACTION_PREFIX,);
  /**
   * Exclusive real-index lock.
   */
  const lockHandle = await open(
    lockPath,
    'wx',
    PRIVATE_FILE_MODE,
  );
  /**
   * Installation marker populated only after atomic replacement.
   */
  const installed = new Set<'installed'>();
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
    realIndexPath,
    installIndex: async function installIndex(sourcePath: string,): Promise<void> {
      /**
       * Exact intended index bytes.
       */
      const bytes = await readFile(sourcePath,);
      await lockHandle.writeFile(bytes,);
      await lockHandle.sync();
      await lockHandle.close();
      await rename(
        lockPath,
        realIndexPath,
      );
      installed.add('installed',);
    },
    [Symbol.asyncDispose]: async function disposeWorkspace(): Promise<void> {
      if (installed.size === 0) {
        await lockHandle.close();
        await rm(
          lockPath,
          { force: true, },
        );
      }
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}
