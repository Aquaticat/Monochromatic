/**
 Fixed relevance question and cache absence retain separate, explicit identities.
 @module
 */

//region Classification wording remains fixed independently of cached estimates.
/** Fixed relevance task. Rule text is bound as data, never rewritten into semantic wording. */
export const RELEVANCE_QUESTION=Object.freeze({
 type:'noul',
 question:'Could the selected rule affect an auto-mode approval, block, or user-confirmation decision for at least one supported operation? Classify potential relevance to the guard, not applicability to a particular action. Do not choose source authority, create an approval, or decide whether an action should execute.',
 criteria:Object.freeze({
  true:'The rule can affect an execution permission, safety restriction, confirmation requirement, or prerequisite relevant to an auto-mode decision in some supported situation.',
  false:'The rule cannot affect that guard decision. Pure presentation or code-style guidance alone is not an execution-permission decision. Lack of applicability to one particular action does not establish irrelevance.'
 }),
 remit:'Auto-mode is the coding-agent execution permission and safety guard. The coding agent still follows rules outside this guard remit. Supported operations include complete enclosing programs with filesystem, subprocess, network, and external-resource effects.'
});
//endregion

//region Missing estimates are ordinary cache states; invalid entries remain failures.
/** Requested content digest has no completed persisted relevance estimate. */
export const CACHE_ENTRY_MISSING:unique symbol=Symbol('requested relevance estimate is absent from the cache');

/** Cache failures never establish a source permission or exclusion. */
export class RuleRelevanceCacheError extends Error {
 /** Preserve the concrete error category, including subclass names. */
 override readonly name=this.constructor.name;
}
//endregion
