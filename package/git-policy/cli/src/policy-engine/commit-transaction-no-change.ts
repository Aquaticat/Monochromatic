//region Normalization-only transaction
/**
 Reconciles a final-newline correction whose complete intended tree equals HEAD.

 @module
 */
import {
  type AddedPathRecord,
  installAddedWorktreeFiles,
} from './commit-transaction-added-paths.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  prepareTransactionJournal,
  recordIndexInstalled,
  resolveCurrentHead,
} from './commit-transaction-journal.ts';
import type { CommitTransactionResult, } from './commit-transaction-types.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';
import { createCoreFindingEvent, } from './events.ts';
import { withFixSummary, } from './fix-summary.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 No normalization-only operation was necessary.
 */
export const NO_CHANGE_NOT_APPLICABLE: unique symbol = Symbol('commit still has a change',);
/**
 Strict Git tree decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Rejects a changed HEAD before or during normalization-only installation.

 @param gitPath - real Git executable

 @param cwd - effective repository directory

 @param expectedOid - commit whose tree was compared with settled selection

 @throws TypeError when another commit changed HEAD

 @example
 ```ts
 await assertNormalizationHead({ gitPath: '/usr/bin/git', cwd: '/repo', expectedOid: 'abc' });
 ```
 */
async function assertNormalizationHead({
  gitPath,
  cwd,
  expectedOid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  expectedOid: string;
}>,): Promise<void> {
  /**
   Current commit identity across public index and worktree mutations.
   */
  const current = await resolveCurrentHead({
    gitPath,
    cwd,
  },);
  if ((current.kind !== 'oid') || (current.oid !== expectedOid))
    throw new TypeError('HEAD changed during normalization-only reconciliation; recovery retained for inspection.',);
}

/**
 Completes an index and worktree correction without creating an empty commit.
 Persists a recovery journal before the first public mutation.

 @param workspace - locked transaction workspace

 @param gitPath - real Git executable

 @param cwd - effective repository directory

 @param repositoryRoot - canonical worktree root

 @param mode - original commit selection mode

 @param eligible - false for explicit allow-empty, amend, and sequencer operations

 @param intendedTreeOid - completely settled private tree

 @param selectedPaths - concrete original selection including policy additions

 @param addedPaths - paths introduced by policies

 @param selectedWorktreePaths - selected newline files matching their initial bytes

 @param pass - settled engine pass

 @param changedPasses - number of fix iterations

 @param changedPaths - fixed paths for summary

 @returns no-commit result or absence when Git still has a commit to make

 @example
 ```ts
 await completeNoChangeTransaction({ workspace, gitPath, cwd, repositoryRoot, mode: 'explicit-path', eligible: true, intendedTreeOid, selectedPaths: [], addedPaths: [], selectedWorktreePaths: [], pass, changedPasses: 1, changedPaths: [] });
 ```
 */
export async function completeNoChangeTransaction({
  workspace,
  gitPath,
  cwd,
  repositoryRoot,
  mode,
  eligible,
  intendedTreeOid,
  selectedPaths,
  addedPaths,
  selectedWorktreePaths,
  pass,
  changedPasses,
  changedPaths,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  mode: 'explicit-path' | 'index';
  eligible: boolean;
  intendedTreeOid: string;
  selectedPaths: readonly string[];
  addedPaths: readonly AddedPathRecord[];
  selectedWorktreePaths: readonly AddedPathRecord[];
  pass: PolicyEngineResult;
  changedPasses: number;
  changedPaths: readonly string[];
}>,): Promise<CommitTransactionResult | typeof NO_CHANGE_NOT_APPLICABLE> {
  if (!eligible)
    return NO_CHANGE_NOT_APPLICABLE;
  /**
   Exact HEAD commit whose immutable tree is compared with settled selection.
   */
  const head = await resolveCurrentHead({
    gitPath,
    cwd,
  },);
  if (head.kind === 'absent')
    return NO_CHANGE_NOT_APPLICABLE;
  /**
   Tree of that exact commit, rather than a later moving HEAD reference.
   */
  const currentTree = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      `${head.oid}^{tree}`,
    ],
  },);
  /**
   Exact current tree for selected comparison.
   */
  const headTreeOid = DECODER.decode(currentTree.stdout,)
    .trim();
  if (headTreeOid !== intendedTreeOid)
    return NO_CHANGE_NOT_APPLICABLE;
  await prepareTransactionJournal({
    workspace,
    gitPath,
    cwd,
    mode,
    amend: false,
    selectedPaths,
    addedPaths,
    selectedWorktreePaths,
    operation: 'normalize-only',
    expectedHeadOid: head.oid,
    intendedTreeOid,
  },);
  workspace.preserveForRecovery();
  await assertNormalizationHead({
    gitPath,
    cwd,
    expectedOid: head.oid,
  },);
  await workspace.installIndex(workspace.postIndexPath,);
  await recordIndexInstalled({ workspace, },);
  await assertNormalizationHead({
    gitPath,
    cwd,
    expectedOid: head.oid,
  },);
  /**
   Worktree copies completed or preserved after concurrent edits.
   */
  const completion = await installAddedWorktreeFiles({
    gitPath,
    cwd,
    repositoryRoot,
    records: [
      ...addedPaths,
      ...selectedWorktreePaths,
    ],
  },);
  await assertNormalizationHead({
    gitPath,
    cwd,
    expectedOid: head.oid,
  },);
  workspace.finishTransaction();
  /**
   Worktree paths whose later edits were retained.
   */
  const { conflicted, } = completion;
  /**
   Whether completion retained later worktree edits.
   */
  const hasConflicts = conflicted.length > 0;
  /**
   Final stable pass plus accurate fix summary.
   */
  const summary = withFixSummary({
    result: pass,
    trigger: 'pre-forward',
    passes: changedPasses,
    changedPaths,
  },);
  return {
    committed: false,
    policyResult: {
      ...summary,
      events: [
        ...summary.events,
        createCoreFindingEvent({
          sequence: summary.events
            .length,
          coreId: 'commit-normalization',
          code: 'no-change',
          message: hasConflicts
            ? `No commit created: normalization removed every selected change; index copies were reconciled, but worktree copies changed and were kept: ${JSON.stringify(conflicted,)}. Compare them with HEAD before retrying.`
            : 'No commit created: normalization removed every selected change; matching worktree and index copies were reconciled.',
        },),
      ],
      exitCode: 1,
      shouldForward: false,
    },
  };
}
//endregion Normalization-only transaction
