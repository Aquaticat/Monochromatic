/**
 * Lazy Git fact contracts.
 *
 * @module
 */

import type {
  CandidateFile,
  GitObjectId,
} from './policy-types.ts';

/**
 * Sentinel representing an intentionally absent Git value. @example `if (oid === ABSENT_GIT_VALUE) return;`
 */
export const ABSENT_GIT_VALUE: unique symbol = Symbol(
  'Git value does not exist for this repository state',
);

/**
 * Type of shared absent Git value. @example `const absent: AbsentGitValue = ABSENT_GIT_VALUE;`
 */
export type AbsentGitValue = typeof ABSENT_GIT_VALUE;

/**
 * Push update supplied by Git. @example `const update: PushUpdate = { localOid: ABSENT_GIT_VALUE, remoteOid: ABSENT_GIT_VALUE, remoteName: 'origin', remoteRef: 'refs/heads/main' };`
 */
export type PushUpdate = Readonly<{
  /**
   * Local object ID, or absence sentinel for deletion.
   */
  localOid: GitObjectId | AbsentGitValue;
  /**
   * Remote object ID, or absence sentinel for creation.
   */
  remoteOid: GitObjectId | AbsentGitValue;
  /**
   * Remote name.
   */
  remoteName: string;
  /**
   * Fully qualified remote ref.
   */
  remoteRef: string;
}>;

/**
 * Lazy Git facts memoized for one candidate-state version. @example `const candidates = await context.git.candidates();`
 */
export type LazyPolicyGitFacts = {
  /**
   * Loads candidate files.
   */
  readonly candidates: () => Promise<readonly CandidateFile[]>;
  /**
   * Loads HEAD object ID, or absence sentinel before first commit.
   */
  readonly headOid: () => Promise<GitObjectId | AbsentGitValue>;
  /**
   * Loads landed commit ID, or absence sentinel before command completion.
   */
  readonly landedCommitOid: () => Promise<GitObjectId | AbsentGitValue>;
  /**
   * Loads push updates.
   */
  readonly pushUpdates: () => Promise<readonly PushUpdate[]>;
};
