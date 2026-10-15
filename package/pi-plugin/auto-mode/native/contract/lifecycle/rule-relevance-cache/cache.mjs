import {indexPolicyDocument} from '../../policy-index.ts';
import {
  RELEVANCE_QUESTION,
  CACHE_ENTRY_MISSING,
  RuleRelevanceCacheError
} from './definition.ts';
import {createRelevanceStore,digest} from './store.ts';

/**
 Bind incremental semantic data to the incumbent original policy selector.
 Bootstrap supplies the parser, namespace and one-call assessment callback.
 No cached value establishes source authority, a qualified exclusion, or permission.
 */
export function bindRuleRelevanceCache({
  selection,
  parse,
  directory,
  namespace,
  profile,
  assessBatch,
  trace
}){
 for(const name of [
   'model',
   'questionVersion',
   'remitVersion',
   'qualificationVersion'
 ])if(((typeof profile?.[name])!=='string')||(!profile[name]))throw new RuleRelevanceCacheError(`Relevance profile field is missing: ${name}`);
 if(((typeof parse)!=='function')||((typeof assessBatch)!=='function')
   ||((typeof trace)!=='function'))throw new RuleRelevanceCacheError('Parser, one-call classifier and diagnostic sink are required');
 const profileJSON=JSON.stringify({
   model:profile.model,
   questionVersion:profile.questionVersion,
   remitVersion:profile.remitVersion,
   qualificationVersion:profile.qualificationVersion,
   definition:RELEVANCE_QUESTION
 });
 const policyScope=profile.policyScope??'AGENTS.md';
 if(((typeof policyScope)!=='string')||(!policyScope)
   ||(policyScope.length>4_096))throw new RuleRelevanceCacheError('Policy scope must be bounded text');
 const profileKey=digest(profileJSON);
   const store=createRelevanceStore({
   directory,
   namespace,
   profileKey,
   trace
 });
 const jobs=new WeakMap();
 const views=new WeakMap();
 const cacheState={currentView:undefined};
 function originalCurrent(source){selection.assertCurrent(source);}
 function materialize(source){
  originalCurrent(source);
  const index=indexPolicyDocument({
    source:source.content,
    parse
  });
  if((index.sourceSha256!==source.sha256)||(index.records
    .length
    >512))throw new RuleRelevanceCacheError('Policy index differs from the current source or exceeds the relevance batch bound');
  const sharedContext=index.unclassified
    .map(function describeRelevanceContextNode(node) { return (({
      type:node.type,
      text:node.text,
      headings:node.headings
        .map(function readRelevanceHeadingText(heading) { return (heading.text); })
    })); });
  const contextKey=digest(JSON.stringify(sharedContext));
  const rules=index.records
    .map(function bindRelevanceRuleKey(rule) {
   const context=Object.freeze(rule.headings
     .map(function readRuleHeadingText(heading) { return (heading.text); }));
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
  originalCurrent(source);return {
    index,
    rules
  };
 }
 async function complete({
   source,
   signal
 }){
  signal?.throwIfAborted();trace({
    event:'relevance-refresh-start',
    sourceSHA256:source.sha256
  });
  const {
    index,
    rules
  }=materialize(source);
    const entries=new Map();
    const missing=[];
  const cached=await Promise.all(rules.map(async function readCachedRule(rule){
   return {rule,entry:await store.read(rule.key)};
  }));
  for(const {rule,entry} of cached){
   if(typeof entry==='symbol'){
    if(entry!==CACHE_ENTRY_MISSING)throw new RuleRelevanceCacheError('Unknown relevance cache absence');
    missing.push(rule);
    continue;
   }
   entries.set(
     rule.id,
     entry
   );
  }
  if(missing.length > 0){
   originalCurrent(source);signal?.throwIfAborted();
   const request=Object.freeze({
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
   const answers=await assessBatch({
     request,
     signal
   });
   originalCurrent(source);signal?.throwIfAborted();
   if((!Array.isArray(answers))||(answers.length!==missing.length))throw new RuleRelevanceCacheError('Classifier answer membership differs from changed rules; no exclusions admitted');
   const byId=new Map();
   for(const answer of answers){
    if((!answer)||((typeof answer.id)!=='string')
      ||byId.has(answer.id)
      ||(!Number.isFinite(answer.probability))
      ||(answer.probability<0)
      ||(answer.probability>1))throw new RuleRelevanceCacheError('Classifier returned a duplicate, missing or invalid relevance estimate');
    byId.set(
      answer.id,
      answer.probability
    );
   }
   for(const rule of missing)if(!byId.has(rule.id))throw new RuleRelevanceCacheError(`Classifier omitted a changed rule: ${rule.id}`);
   // Validate the whole batch before publishing any entry.
   originalCurrent(source);signal?.throwIfAborted();
   const published=await Promise.all(missing.map(async function publishChangedRule(rule){
    return {id:rule.id,entry:await store.put({key:rule.key,probability:byId.get(rule.id)})};
   }));
   for(const {id,entry} of published)entries.set(id,entry);
  }
  originalCurrent(source);signal?.throwIfAborted();
  const view=Object.freeze({
    sourceSHA256:source.sha256,
    namespaceKey:store.namespaceKey,
    profileKey,
    rules:Object.freeze(rules.map(function attachRetainedProbability(rule) { return (Object.freeze({
      ...rule,
      probability:entries.get(rule.id)
        .probability,
      qualification:'not-established'
    })); })),
    requestedRuleIds:Object.freeze(missing.map(function readRelevantRuleId(rule) { return (rule.id); })),
    structuralCoverage:index.structuralCoverage,
    unclassifiedNodes:index.unclassified
      .length,
    candidateRuleIds:Object.freeze(rules.map(function readRemainingRuleId(rule) { return (rule.id); })),
    exclusionsAdmitted:false,
    permission:false
  });
  trace({
    event:'relevance-view-prepared',
    sourceSHA256:source.sha256,
    requested:missing.length,
    reused:rules.length-missing.length
  });
  originalCurrent(source);signal?.throwIfAborted();
  views.set(
    view,
    source
  );cacheState.currentView=view;return view;
 }
 function refresh({signal}={}){
  signal?.throwIfAborted();
  const source=selection.capture();originalCurrent(source);
  const pending=jobs.get(source);
  if(pending)return pending.promise;
  // Publish completion before calling an injected classifier, so recursive refresh joins it.
  const job=Promise.withResolvers();jobs.set(
    source,
    job
  );
  async function run(){
   try{job.resolve(await complete({
     source,
     signal
   }));}
   catch(error){
    try{trace({
      event:'relevance-refresh-failed',
      sourceSHA256:source.sha256,
      error
    });}
    catch(traceError){job.reject(new AggregateError(
      [
        error,
        traceError
      ],
      'Relevance refresh and failure reporting both failed'
    ));return;}
    job.reject(error);
   }
  }
  void run();return job.promise;
 }
 function assertCurrent(view){
  const source=views.get(view);
  if((!source)||(cacheState.currentView!==view))throw new RuleRelevanceCacheError('Relevance view is not the current original policy-cache view');
  originalCurrent(source);
 }
 function readCurrent(){
  if(!cacheState.currentView)throw new RuleRelevanceCacheError('Policy relevance has not completed; keep rules included');
  assertCurrent(cacheState.currentView);return cacheState.currentView;
 }
 return Object.freeze({
   refresh,
   assertCurrent,
   readCurrent,
   profileKey,
   namespaceKey:store.namespaceKey
 });
}
