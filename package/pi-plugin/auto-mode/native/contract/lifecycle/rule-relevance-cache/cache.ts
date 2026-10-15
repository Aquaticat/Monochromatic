/**
 Relevance ownership joins recursive refreshes and publishes only current original-source views.
 @module
 */
import type {RelevanceCache,RelevanceCacheInput,RelevanceRefreshInput,RelevanceSource,RelevanceView} from './cache-types.ts';
import {RELEVANCE_QUESTION,RuleRelevanceCacheError} from './definition.ts';
import {completeRelevanceRefresh,type RelevanceRefreshContext} from './refresh.ts';
import {createRelevanceStore,digest} from './store.ts';

//region Fixed bootstrap configuration cannot be selected by classifier data.
/** Declared policy paths remain bounded before profile-sensitive key construction. */
const maximumPolicyScopeLength=4_096;
/**
 Bind incremental estimates to the incumbent original policy selector.
 @param selection - original source custody and freshness owner
 @param parse - qualified Markdown parser
 @param directory - application-owned private cache parent
 @param namespace - fixed repository and primary branch identities
 @param profile - exact classifier identity and declared policy scope
 @param assessBatch - original one-call classifier callback
 @param trace - original diagnostic sink
 @returns cache owner retaining source-identity jobs and current-view membership
 @throws RuleRelevanceCacheError when fixed configuration cannot be admitted
 @example
 ```ts
 const cache=bindRuleRelevanceCache({selection,parse,directory,namespace,profile,assessBatch,trace});
 ```
 */
export function bindRuleRelevanceCache({selection,parse,directory,namespace,profile,assessBatch,trace}:RelevanceCacheInput):RelevanceCache{
 for(const name of ['model','questionVersion','remitVersion','qualificationVersion'] as const){
  if((typeof profile?.[name]!=='string')||(profile[name].length===0)){
   throw new RuleRelevanceCacheError(`Relevance profile field is missing: ${name}`);
  }
 }
 if((typeof parse!=='function')||(typeof assessBatch!=='function')||(typeof trace!=='function')){
  throw new RuleRelevanceCacheError('Parser, one-call classifier and diagnostic sink are required');
 }
 /** Serialized field order and original question wording preserve existing cache keys. */
 const profileJSON=JSON.stringify({
  model:profile.model,questionVersion:profile.questionVersion,remitVersion:profile.remitVersion,
  qualificationVersion:profile.qualificationVersion,definition:RELEVANCE_QUESTION
 });
 /** Scope defaults to the incumbent root policy path. */
 const policyScope=profile.policyScope??'AGENTS.md';
 if((typeof policyScope!=='string')||(policyScope.length===0)||(policyScope.length>maximumPolicyScopeLength)){
  throw new RuleRelevanceCacheError('Policy scope must be bounded text');
 }
 /** The fixed profile independently partitions persisted relevance estimates. */
 const profileKey=digest(profileJSON);
 /** Filesystem work begins only when the original refresh needs an entry. */
 const store=createRelevanceStore({directory,namespace,profileKey,trace});
 /** Recursive calls join the original source occurrence's pending completion. */
 const jobs=new WeakMap<RelevanceSource,PromiseWithResolvers<RelevanceView>>();
 /** Views retain their exact original source object, never a reconstructed digest identity. */
 const views=new WeakMap<RelevanceView,RelevanceSource>();
 /** Current-view absence is owned state before any successful publication. */
 const cacheState:{currentView?:RelevanceView}={};
 /**
  Publish synchronously after the work boundary's final freshness and cancellation checks.
  @param source - original source occurrence retained by the selector
  @param view - complete unqualified relevance view
  */
 function publish({source,view}:{readonly source:RelevanceSource;readonly view:RelevanceView}):void{
  views.set(view,source);
  cacheState.currentView=view;
 }
 /** Work borrows fixed configuration while view publication remains owned here. */
 const context:RelevanceRefreshContext={selection,parse,assessBatch,trace,profileKey,policyScope,store,publish};
 /**
  Publish the completion handle before any injected classifier can recursively refresh.
  @param input - original caller cancellation options
  @returns identical original completion for this source occurrence
  */
 function refresh(input:RelevanceRefreshInput={}):Promise<RelevanceView>{
  input.signal?.throwIfAborted();
  /** Capture remains synchronous and belongs to the incumbent source selector. */
  const source=selection.capture();
  selection.assertCurrent(source);
  /** Existing jobs preserve original caller cancellation ownership. */
  const pending=jobs.get(source);
  if(pending!==undefined)return pending.promise;
  /** Register completion before refresh work can call an injected callback. */
  const job=Promise.withResolvers<RelevanceView>();
  jobs.set(source,job);
  /** Settle the original completion with preserved work and reporting failures. */
  async function run():Promise<void>{
   try{
    job.resolve(await completeRelevanceRefresh({source,input,context}));
   }
   catch(error){
    try{
     trace({event:'relevance-refresh-failed',sourceSHA256:source.sha256,error});
    }
    catch(traceError){
     job.reject(new AggregateError([error,traceError],'Relevance refresh and failure reporting both failed'));
     return;
    }
    job.reject(error);
   }
  }
  void run();
  return job.promise;
 }
 /**
  Recheck view ownership and the original selector's current-source contract.
  @param view - original completed relevance view
  @throws RuleRelevanceCacheError when the view is foreign or no longer current
  */
 function assertCurrent(view:RelevanceView):void{
  /** Membership retains original source object identity. */
  const source=views.get(view);
  if((source===undefined)||(cacheState.currentView!==view)){
   throw new RuleRelevanceCacheError('Relevance view is not the current original policy-cache view');
  }
  selection.assertCurrent(source);
 }
 /**
  Return only a completed view whose original source remains current.
  @returns original current unqualified view
  @throws RuleRelevanceCacheError when no refresh has completed successfully
  */
 function readCurrent():RelevanceView{
  if(cacheState.currentView===undefined)throw new RuleRelevanceCacheError('Policy relevance has not completed; keep rules included');
  assertCurrent(cacheState.currentView);
  return cacheState.currentView;
 }
 return Object.freeze({refresh,assertCurrent,readCurrent,profileKey,namespaceKey:store.namespaceKey});
}
//endregion
