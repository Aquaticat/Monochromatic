/**
 Relevance materialization preserves source intervals, cache context, and complete answer membership.
 @module
 */
import {indexPolicyDocument} from '../../policy-index.ts';
import type {PolicyIndexInput} from '../../policy-index-types.ts';
import type {
  MaterializedRelevance,
  RelevanceRule,
  RelevanceSource
} from './cache-types.ts';
import {RuleRelevanceCacheError} from './definition.ts';
import {digest} from './store.ts';

//region Cache keys bind exact original rule text and retained unclassified context.
/**
 Fixed changed-rule batch bound keeps one classifier request bounded.
 */
const maximumRuleCount=512;
/**
 Index the complete source and derive original context-sensitive cache identities.
 
 @param source - current original policy occurrence
 
 @param parse - qualified Markdown parser
 
 @param profileKey - fixed classifier profile digest
 
 @param policyScope - declared policy path
 
 @returns original structural accounting and ordered cache-keyed rules
 
 @throws RuleRelevanceCacheError when the source digest or batch bound differs
 
 @example
 ```ts
 const materialized=materializeRelevance({source,parse,profileKey,policyScope});
 ```
 */
export function materializeRelevance({
  source,
  parse,
  profileKey,
  policyScope
}:{
 readonly source:RelevanceSource;
 readonly parse:PolicyIndexInput['parse'];
 readonly profileKey:string;
 readonly policyScope:string;
}):MaterializedRelevance{
 /**
  Structural indexing preserves every original source span.
  */
 const index=indexPolicyDocument({
   source:source.content,
   parse
 });
 if((index.sourceSha256!==source.sha256)||(index.records
   .length
   >maximumRuleCount)){
  throw new RuleRelevanceCacheError('Policy index differs from the current source or exceeds the relevance batch bound');
 }
 /**
  Unclassified nodes contribute context without becoming approved instructions.
  */
 const sharedContext=index.unclassified
   .map(function describeContext(node){
  return {
    type:node.type,
    text:node.text,
    headings:node.headings
      .map(function headingText(heading){
   return heading.text;
  })
  };
 });
 /**
  Any shared-context change invalidates the corresponding rule estimates.
  */
 const contextKey=digest(JSON.stringify(sharedContext));
 /**
  Rule order and exact source spans remain unchanged.
  */
 const rules=index.records
   .map(function bindRuleKey(rule):RelevanceRule{
  /**
   Original heading text participates in the fixed digest.
   */
  const context=Object.freeze(rule.headings
    .map(function headingText(heading){
   return heading.text;
  }));
  /**
   Serialized field order matches the original persisted-key contract.
   */
  const key=digest(JSON.stringify({
    profileKey,
    scope:policyScope,
    contextKey,
    code:rule.code,
    text:rule.text,
    headings:context
  }));
  return Object.freeze({
    id:rule.code,
    key,
    text:rule.text,
    headings:context,
    start:rule.start,
    end:rule.end
  });
 });
 return {
   index,
   rules
 };
}
//endregion

//region Complete answer admission precedes every changed-rule publication.
/**
 Validate the entire untrusted response before any entry can be persisted.
 
 @param answers - original classifier delivery
 
 @param missing - exact changed or missing source membership
 
 @returns finite estimates keyed by the original source handles
 
 @throws RuleRelevanceCacheError when membership, uniqueness, or estimates differ
 
 @example
 ```ts
 const estimates=admitRelevanceAnswers({answers,missing});
 ```
 */
export function admitRelevanceAnswers({
  answers,
  missing
}:{
  readonly answers:unknown;
  readonly missing:readonly RelevanceRule[]
}):ReadonlyMap<string,number>{
 if((!Array.isArray(answers))||(answers.length!==missing.length)){
  throw new RuleRelevanceCacheError('Classifier answer membership differs from changed rules; no exclusions admitted');
 }
 /**
  Array admission does not trust the shape of any delivered value.
  */
 const delivered:readonly unknown[]=answers;
 /**
  Duplicate source handles cannot overwrite an earlier estimate.
  */
 const byId=new Map<string,number>();
 for(const answer of delivered){
  if(((typeof answer)!=='object')||(answer===null)
    ||(!('id' in answer))
    ||((typeof answer.id)!=='string')
    ||byId.has(answer.id)
    ||(!('probability' in answer))
    ||((typeof answer.probability)!=='number')
    ||(!Number.isFinite(answer.probability))
    ||(answer.probability<0)
    ||(answer.probability>1)){
   throw new RuleRelevanceCacheError('Classifier returned a duplicate, missing or invalid relevance estimate');
  }
  byId.set(
    answer.id,
    answer.probability
  );
 }
 for(const rule of missing){
  if(!byId.has(rule.id))throw new RuleRelevanceCacheError(`Classifier omitted a changed rule: ${rule.id}`);
 }
 return byId;
}
//endregion
