/**
 Code-owned semantic admission configuration is not an interpretation fact.

 @module
 */

/**
 Only implemented semantic consumers may receive a captured policy.
 */
export type SemanticAdmissionDefinition =
  | 'clause_operation_relation'
  | 'request_instruction_content'
  | 'heading_instruction_content'
  | 'unit_adoption';

/**
 Fixed callback receives an original decoded estimate; consumers validate its Boolean result.
 */
export type SemanticAcceptance = (value: unknown,) => unknown;

/**
 Owned bootstrap fields retain the borrowed callback identity without freezing it.
 */
export type SemanticAdmissionPolicy = {
  /**
   Selected serving model, independent of transport role labels.
   */
  readonly model: string;
  /**
   Implemented consumer definition, never a caller-supplied verdict.
   */
  readonly definitionId: SemanticAdmissionDefinition;
  /**
   Required original complete-program inspection profile.
   */
  readonly programProfile: string;
  /**
   Fixed code acceptance rule without default admission.
   */
  readonly accepts: SemanticAcceptance;
};

/**
 Borrowed original inspection metadata; the native caller authenticates its owners.
 */
export type SemanticAdmissionInputs = {
  /**
   Every prepared operation must have the configured inspection profile.
   */
  readonly effects: readonly {
    readonly programInspection?: { readonly declaration: { readonly profile: string; }; };
  }[];
  /**
   Original retained clause handles, when supported by the owner.
   */
  readonly instructionCandidates?: readonly unknown[];
  /**
   Legacy clause handles remain available for their original profile.
   */
  readonly ruleCandidates: readonly unknown[];
};

/**
 Matching configuration establishes a consumer, not semantic truth or execution authority.
 */
export type SemanticAdmissionScope =
  | {
    /**
     No estimate request is admitted through this scope.
     */
    readonly state: 'not-configured' | 'out-of-profile' | 'no-indexed-clauses';
    /**
     Code-owned explanation of the missing configuration or original inspection.
     */
    readonly reason: string;
  }
  | {
    /**
     Selected original inspection and configured code consumer match.
     */
    readonly state: 'matching';
    /**
     Fixed assessment model supplied by native bootstrap, not the action caller.
     */
    readonly model: string;
    /**
     Captured consumer definition.
     */
    readonly definitionId: SemanticAdmissionDefinition;
    /**
     Captured complete-program inspection profile.
     */
    readonly programProfile: string;
  };
