/**
 Types of the landing loop:
 its input,
 the candidate each landing attempt lands,
 and its outcome.

 @module
 */
import type { HookChanges, } from './commit-hook-changes.ts';
import type { PreparedCommit, } from './commit-preparation-native.ts';
import type { ReplayOptions, } from './commit-replay-options.ts';
import type { RevalidationContext, } from './commit-revalidation.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import type { PreparationBase, } from './commit-transaction-capture.ts';
import type { TransactionMode, } from './commit-transaction-journal-states.ts';
import type { PolicyEvent, } from './events.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 What the next landing attempt lands.
 */
export type LandingCandidate = Readonly<{
  /**
   Commit to land.
   */
  newOid: string;
  /**
   Its tree.
   */
  treeOid: string;
  /**
   Target value its parent names.
   */
  expectedOld: PreparationBase;
  /**
   Private index holding its tree.
   */
  indexPath: string;
  /**
   Whether that index is the one native preparation committed.
   */
  exactPrivateIndex: boolean;
  /**
   Tree `pre-commit` last approved.
   */
  approvedTree: string;
  /**
   Paths an explicit-path landing resets.
   */
  committedPaths: readonly string[];
  /**
   Policy-added paths.
   */
  addedPaths: readonly AddedPathRecord[];
  /**
   Selected, corrected, and hook-changed worktree completions.
   */
  worktreeRecords: readonly AddedPathRecord[];
  /**
   Everything commit hooks staged so far.
   */
  hookChanges: HookChanges;
  /**
   Events of lost races, replays, and revalidations so far.
   */
  events: readonly PolicyEvent[];
  /**
   Landing attempt number.
   */
  attempt: number;
  /**
   Lost races so far.
   */
  lostRaces: number;
}>;

/**
 Loop result.
 */
export type LandingLoopOutcome =
  | Readonly<{
    /**
     The commit landed.
     */
    kind: 'landed';
    /**
     Landed commit.
     */
    oid: string;
    /**
     Events to append after the settled preparation pass.
     */
    events: readonly PolicyEvent[];
    /**
     Worktree completions for the landed commit.
     */
    worktreeRecords: readonly AddedPathRecord[];
    /**
     Policy-added paths of the landed commit.
     */
    addedPaths: readonly AddedPathRecord[];
  }>
  | Readonly<{
    /**
     Nothing landed.
     */
    kind: 'failed';
    /**
     Complete blocking result.
     */
    result: PolicyEngineResult;
  }>;

/**
 Inputs of the loop.
 */
export type LandingLoopInput = Readonly<{
  /**
   Invocation facts replay and revalidation reuse.
   */
  context: RevalidationContext;
  /**
   Commit selection mode.
   */
  mode: TransactionMode;
  /**
   Verified prepared commit.
   */
  prepared: PreparedCommit;
  /**
   Settled preparation pass with its fix summary.
   */
  settled: PolicyEngineResult;
  /**
   Replay-relevant commit options.
   */
  options: ReplayOptions;
  /**
   Paths an explicit-path commit carries.
   */
  committedPaths: readonly string[];
  /**
   Policy-added paths.
   */
  addedPaths: readonly AddedPathRecord[];
  /**
   Worktree completions.
   */
  worktreeRecords: readonly AddedPathRecord[];
  /**
   What preparation hooks staged.
   */
  hookChanges: HookChanges;
  /**
   Backoff budget for a foreign `index.lock`.
   */
  indexLockTimeoutMs: number;
  /**
   Lost landing races after which the transaction takes the landing reservation.
   */
  reserveAfterLostRaces: number;
}>;
