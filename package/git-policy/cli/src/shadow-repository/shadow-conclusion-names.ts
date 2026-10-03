/**
 Names of the per-worktree conclusion state a merge, cherry-pick, or revert conclusion reads.

 @module
 */

/**
 Conclusion state files copied into the shadow at preparation.
 */
export const CONCLUSION_STATE_FILES = [
  'MERGE_HEAD',
  'MERGE_MSG',
  'MERGE_MODE',
  'SQUASH_MSG',
  'AUTO_MERGE',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'MERGE_RR',
] as const;

/**
 Conclusion state directory copied into the shadow at preparation.
 */
export const SEQUENCER_DIRECTORY = 'sequencer';

/**
 Pseudorefs a reftable repository keeps in its ref store rather than as files
 (only `FETCH_HEAD` and `MERGE_HEAD` stay files, `is_pseudo_ref` in Git's `refs.c`).
 */
export const STORE_HELD_PSEUDOREFS: ReadonlySet<string> = new Set([
  'AUTO_MERGE',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
],);

/**
 Conclusion entries landing removes from the owning worktree when native Git removed them from the shadow.
 */
export const REMOVED_CONCLUSION_FILES = [
  'AUTO_MERGE',
  'MERGE_HEAD',
  'MERGE_MODE',
  'MERGE_MSG',
  'SQUASH_MSG',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
] as const;

/**
 Every conclusion entry name, private to the shadow.
 */
export const CONCLUSION_STATE_NAMES: readonly string[] = [
  ...CONCLUSION_STATE_FILES,
  SEQUENCER_DIRECTORY,
];
