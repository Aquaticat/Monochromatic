/**
 Commit transaction public result and policy option types.
 
 @module
 */
import type {
  PolicyEngineResult,
  RunPolicyEngineOptions,
} from './types.ts';

/**
 Transaction result before shared post-commit lifecycle.
 */
export type CommitTransactionResult = Readonly<{
  /**
   Final stable policy result.
   */
  policyResult: PolicyEngineResult;
  /**
   Whether transaction landed a real commit.
   */
  committed: boolean;
  /**
   Landed commit, present exactly when `committed` is true; later lifecycle steps read it instead of live `HEAD`.
   */
  landedOid?: string;
}>;

/**
 Policy options supplied identically on every convergence pass.
 */
export type CommitTransactionPolicyOptions = Omit<
  RunPolicyEngineOptions,
  'args' | 'trigger' | 'gitFacts' | 'candidateVersion' | 'repositoryRoot'
>;
