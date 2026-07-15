/**
 * Private-index candidate facts for pre-forward Git add policies.
 *
 * @module
 */
import { randomUUID, } from 'node:crypto';
import {
  copyFile,
  mkdir,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import type { LazyPolicyGitFacts, } from '../api/context-types.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  captureIndexRecords,
  stagedDeltaPaths,
} from './add-staged-delta.ts';
import {
  createPrivateIndexFacts,
  listPrivateIndexPaths,
} from './commit-transaction-candidates.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';

/**
 * Add policy facts do not apply to current command.
 */
export const ADD_POLICY_FACTS_NOT_APPLICABLE: unique symbol = Symbol('add policy facts not applicable',);
/**
 * Strict Git path decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 * Private add-check directory mode.
 */
const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 * Scoped private add candidate state.
 */
export type AddPolicyFactsScope = {
  /**
   * Canonical repository root.
   */
  readonly repositoryRoot: string;
  /**
   * Exact would-be-index candidate facts.
   */
  readonly gitFacts: LazyPolicyGitFacts;
  /**
   * Private workspace directory.
   */
  readonly directory: string;
  /**
   * Private candidate index path.
   */
  readonly indexPath: string;
  /**
   * Real index path that must remain unchanged during direct fix.
   */
  readonly realIndexPath: string;
  /**
   * Candidate paths selected by caller scope.
   */
  readonly paths: readonly string[];
  /**
   * Removes private index state.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Resolves absolute Git administrative path.
 *
 * @param cwd - effective repository cwd
 *
 * @param reportedPath - Git path output
 *
 * @returns absolute path
 */
function absoluteGitPath({
  cwd,
  reportedPath,
}: Readonly<{
  cwd: string;
  reportedPath: string;
}>,): string {
  return isAbsolute(reportedPath,) ? reportedPath : resolve(
    cwd,
    reportedPath,
  );
}

/**
 * Creates exact private-index facts for one noninteractive add invocation.
 *
 * @param args - wrapper-control-free Git arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @param candidatePathspecs - optional unchanged-inclusive candidate scope
 *
 * @returns scoped facts or not-applicable sentinel
 *
 * @example
 * ```ts
 * await createAddPolicyFacts({ args: ['add', 'file.txt'], gitPath: '/usr/bin/git' });
 * ```
 */
export async function createAddPolicyFacts({
  args,
  gitPath,
  candidatePathspecs,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  candidatePathspecs?: readonly string[];
}>,): Promise<AddPolicyFactsScope | typeof ADD_POLICY_FACTS_NOT_APPLICABLE> {
  /**
   * Effective command layout after global options.
   */
  const layout = parseGlobalOptions(args,);
  if (args[layout.subcommandIndex] !== 'add')
    return ADD_POLICY_FACTS_NOT_APPLICABLE;
  /**
   * Exact repository root or failure outside worktree.
   */
  const rootResult = await runTransactionGit({
    gitPath,
    cwd: layout.effectiveCwd,
    args: [
      'rev-parse',
      '--show-toplevel',
    ],
    allowFailure: true,
  },);
  if (rootResult.exitCode !== 0)
    return ADD_POLICY_FACTS_NOT_APPLICABLE;
  /**
   * Canonical repository root spelling from Git.
   */
  const repositoryRoot = DECODER.decode(rootResult.stdout,)
    .trim();
  /**
   * Current real-index path from Git.
   */
  const reportedIndex = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd: layout.effectiveCwd,
    args: [
      'rev-parse',
      '--git-path',
      'index',
    ],
  },)).stdout,)
    .trim();
  /**
   * Absolute real-index path.
   */
  const realIndexPath = absoluteGitPath({
    cwd: layout.effectiveCwd,
    reportedPath: reportedIndex,
  },);
  /**
   * Private candidate directory beside real index.
   */
  const directory = join(
    dirname(realIndexPath,),
    `cli-git-add-policy-${randomUUID()}`,
  );
  await mkdir(
    directory,
    { mode: PRIVATE_DIRECTORY_MODE, },
  );
  /**
   * Private would-be add index.
   */
  const indexPath = join(
    directory,
    'index',
  );
  try {
    await copyFile(
      realIndexPath,
      indexPath,
    );
  }
  catch (error: unknown) {
    if (!(Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT')))
      throw error;
    await runTransactionGit({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath,
      args: [
        'read-tree',
        '--empty',
      ],
    },);
  }
  /**
   * Complete records before replaying the add, scoping the add gate to
   * exactly the entries this invocation stages.
   */
  const beforeRecords = await captureIndexRecords({
    gitPath,
    cwd: layout.effectiveCwd,
    indexPath,
  },);
  await runTransactionGit({
    gitPath,
    cwd: layout.effectiveCwd,
    indexPath,
    args: args.slice(layout.subcommandIndex,),
  },);
  /**
   * Paths this add staged or exact unchanged-inclusive direct scope.
   */
  const paths = candidatePathspecs === undefined
    ? await stagedDeltaPaths({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath,
      before: beforeRecords,
    },)
    : await listPrivateIndexPaths({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath,
      pathspecs: candidatePathspecs,
    },);
  return {
    repositoryRoot,
    directory,
    indexPath,
    realIndexPath,
    paths,
    gitFacts: createPrivateIndexFacts({
      gitPath,
      cwd: layout.effectiveCwd,
      indexPath,
      paths,
    },),
    [Symbol.asyncDispose]: async function disposeAddPolicyFacts(): Promise<void> {
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
