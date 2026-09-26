/**
 Startup recovery outcome types shared by legacy and per-transaction recovery.

 @module
 */

/**
 Action startup recovery took for one transaction directory.
 */
export type CommitTransactionRecoveryAction =
  | 'commit-not-created'
  | 'normalization-installed'
  | 'index-installed'
  | 'already-installed'
  | 'owner-active'
  | 'vanished'
  | 'staging-unattributed'
  | 'staging-retained'
  | 'retired-removed';

/**
 Recovery action for one transaction directory.
 */
export type CommitTransactionRecoveryOutcome = Readonly<{
  /**
   Exact transaction directory examined.
   */
  directory: string;
  /**
   Action taken, or why the directory was left in place.
   */
  action: CommitTransactionRecoveryAction;
}>;
