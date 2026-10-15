/**
 Refresh work keeps original source and cancellation checks across every asynchronous boundary.
 @module
 */
import {nonNullishOrThrow} from '@monochromatic-dev/module-or-throw/ts';
import type {
  RelevanceCacheInput,
  RelevanceRefreshInput,
  RelevanceRequest,
  RelevanceRule,
  RelevanceSource,
  RelevanceView
} from './cache-types.ts';
import {
  CACHE_ENTRY_MISSING,
  RELEVANCE_QUESTION,
  RuleRelevanceCacheError
} from './definition.ts';
import {
  admitRelevanceAnswers,
  materializeRelevance
} from './materialization.ts';
import type {
  RelevanceEntry,
  RelevanceStore
} from './store-types.ts';

//region The bound cache owns configuration and synchronous publication authority.
/**
 Refresh work borrows original source custody and the owner's publication callback.
 */
export type RelevanceRefreshContext=Pick<RelevanceCacheInput,'selection'|'parse'|'assessBatch'|'trace'>&{
 /**
  Fixed classifier profile digest.
  */
 readonly profileKey:string;
 /**
  Declared original policy path.
  */
 readonly policyScope:string;
 /**
  Owner-local persisted-entry lifetime.
  */
 readonly store:RelevanceStore;
 /**
  Publish without yielding after the final source and cancellation checks.
  */
 readonly publish:(input:{
  /**
   Original source occurrence, never reconstructed from a digest.
   */
  readonly source:RelevanceSource;
  /**
   Complete original-source view.
   */
  readonly view:RelevanceView;
 })=>void;
};
//endregion

//region Complete refresh work preserves every original freshness check and batch boundary.
/**
 Reuse completed estimates and classify only missing rules before synchronous view publication.
 
 @param source - original source occurrence captured by the cache owner
 
 @param input - original caller's cancellation options
 
 @param context - fixed configuration and original ownership callbacks
 
 @returns current unqualified view after original source and cancellation checks
 
 @throws RuleRelevanceCacheError when cache state or classifier answers cannot be admitted
 
 @example
 ```ts
 const view=await completeRelevanceRefresh({source,input,context});
 ```
 */
export async function completeRelevanceRefresh({
  source,
  input,
  context
}:{
 readonly source:RelevanceSource;
 readonly input:RelevanceRefreshInput;
 readonly context:RelevanceRefreshContext;
}):Promise<RelevanceView>{
 /**
  Fixed owner dependencies never come from classifier response data.
  */
 const {
   selection,
   parse,
   assessBatch,
   trace,
   profileKey,
   policyScope,
   store,
   publish
 }=context;
 /**
  The same caller signal remains controlling throughout the refresh.
  */
 const {signal}=input;
 signal?.throwIfAborted();
 trace({
   event:'relevance-refresh-start',
   sourceSHA256:source.sha256
 });
 selection.assertCurrent(source);
 /**
  Indexing stays between the same original source checks as materialization.
  */
 const {
   index,
   rules
 }=materializeRelevance({
   source,
   parse,
   profileKey,
   policyScope
 });
 selection.assertCurrent(source);
 /**
  Completed estimates are keyed by original literal source handles.
  */
 const entries=new Map<string,RelevanceEntry>();
 /**
  Missing membership preserves original source order.
  */
 const missing:RelevanceRule[]=[];
 /**
  Owner-local writes settle before any corresponding persisted read completes.
  */
 const cached=await Promise.all(rules.map(async function readCachedRule(rule){
  return {
    rule,
    entry:await store.read(rule.key)
  };
 }));
 for(const {
   rule,
   entry
 } of cached){
  if((typeof entry)==='symbol'){
   if(entry!==CACHE_ENTRY_MISSING)throw new RuleRelevanceCacheError('Unknown relevance cache absence');
   missing.push(rule);
   continue;
  }
  entries.set(
    rule.id,
    entry
  );
 }
 if(missing.length>0){
  selection.assertCurrent(source);
  signal?.throwIfAborted();
  /**
   Whole source context accompanies only the changed literal rules.
   */
  const request:RelevanceRequest=Object.freeze({
    fullPolicy:source.content,
    sourceSHA256:source.sha256,
    profileKey,
    definition:RELEVANCE_QUESTION,
    rules:Object.freeze(missing),
    semanticQualification:'not-established'
  });
  trace({
    event:'relevance-classify-batch',
    count:missing.length,
    sourceSHA256:source.sha256
  });
  /**
   Delivery is untrusted until complete membership and probability validation.
   */
  const answers=await assessBatch({
    ...input,
    request
  });
  selection.assertCurrent(source);
  signal?.throwIfAborted();
  /**
   The entire batch is admitted before any estimate is published.
   */
  const byId=admitRelevanceAnswers({
    answers,
    missing
  });
  selection.assertCurrent(source);
  signal?.throwIfAborted();
  /**
   Original missing membership controls publication, never response ordering.
   */
  const published=await Promise.all(missing.map(async function publishChangedRule(rule){
   return {
     id:rule.id,
     entry:await store.put({
       key:rule.key,
       probability:nonNullishOrThrow(byId.get(rule.id))
     })
   };
  }));
  for(const {
    id,
    entry
  } of published)entries.set(
    id,
    entry
  );
 }
 selection.assertCurrent(source);
 signal?.throwIfAborted();
 /**
  Every original rule remains included; estimates confer neither permission nor qualification.
  */
 const view:RelevanceView=Object.freeze({
   sourceSHA256:source.sha256,
   namespaceKey:store.namespaceKey,
   profileKey,
   rules:Object.freeze(rules.map(function attachEstimate(rule){
   return Object.freeze({
     ...rule,
     probability:nonNullishOrThrow(entries.get(rule.id))
       .probability,
     qualification:'not-established' as const
   });
  })),
   requestedRuleIds:Object.freeze(missing.map(function requestedId(rule){
   return rule.id;
  })),
   structuralCoverage:index.structuralCoverage,
   unclassifiedNodes:index.unclassified
     .length,
   candidateRuleIds:Object.freeze(rules.map(function candidateId(rule){
   return rule.id;
  })),
   exclusionsAdmitted:false,
   permission:false
 });
 trace({
   event:'relevance-view-prepared',
   sourceSHA256:source.sha256,
   requested:missing.length,
   reused:rules.length-missing.length
 });
 selection.assertCurrent(source);
 signal?.throwIfAborted();
 publish({
   source,
   view
 });
 return view;
}
//endregion
