/**
 Fixed relevance question and cache absence retain separate, explicit identities.
 @module
 */

//region Classification wording remains fixed independently of cached estimates.
/**
 Fixed relevance input never supplies a rule interpretation or permission.
 */
export type RelevanceQuestion={
 /**
  Independent probability head retained by the original classifier.
  */
 readonly type:'noul';
 /**
  Exact fixed relevance question.
  */
 readonly question:string;
 /**
  Opposed criteria define the fixed probability interpretation.
  */
 readonly criteria:{
  /**
   Evidence for potential guard relevance.
   */
  readonly true:string;
  /**
   Evidence for absence of guard relevance.
   */
  readonly false:string;
 };
 /**
  Supported operation scope is fixed independently of a particular action.
  */
 readonly remit:string;
};
/**
 Fixed relevance task. Rule text is bound as data, never rewritten into semantic wording.
 */
export const RELEVANCE_QUESTION:RelevanceQuestion=Object.freeze({
 type:'noul',
 question:'Could the selected rule affect an auto-mode approval, block, or user-confirmation decision for at least one supported operation? Classify potential relevance to the guard, not applicability to a particular action. Do not choose source authority, create an approval, or decide whether an action should execute.',
 criteria:Object.freeze({
  true:'The rule restricts access or effects, requires consent, or defines authorization for an execution permission in some supported situation. Uncertain or mixed rules that may contain such a boundary remain potentially relevant.',
  false:'The rule cannot affect execution permission. Tool choice, command syntax, formatting, code style, testing, documentation, and workflow conventions alone are coding-agent guidance, not permission boundaries. Lack of applicability to one particular action does not establish irrelevance.'
 }),
 remit:'Auto-mode is the coding-agent execution permission and safety guard. The coding agent still follows rules outside this guard remit. Supported operations include complete enclosing programs with filesystem, subprocess, network, and external-resource effects.'
});
//endregion

//region Missing estimates are ordinary cache states; invalid entries remain failures.
/**
 Requested content digest has no completed persisted relevance estimate.
 */
export const CACHE_ENTRY_MISSING:unique symbol=Symbol('requested relevance estimate is absent from the cache');

/**
 Cache failures never establish a source permission or exclusion.
 */
export class RuleRelevanceCacheError extends Error {
 /**
  Preserve the cache's concrete error category.
  */
 override readonly name='RuleRelevanceCacheError';
}
//endregion
