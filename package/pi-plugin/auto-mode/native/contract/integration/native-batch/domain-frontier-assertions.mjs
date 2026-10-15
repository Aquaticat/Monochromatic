import {alteredContribution} from './domain-receipt-controls.mjs';
import {assertDomainTransport} from './domain-transport-assertions.mjs';
import {assertObservedDomainContext} from './domain-context-assertions.mjs';
import {assertCompleteDomainResolution} from './domain-resolution-assertions.mjs';
import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {assertNativeSessionInputCapture} from './generated/session-manager.mjs';

//region Native review assertions retain every authored contrast and original domain control

/** Verify the observed decision and execution against this fixture's original selected contrasts. */
export function assertDomainReview({
  env,
  review,
  judgment,
  session,
  originalBody,
  settings,
  measures
}){
 const {
   relation,
   requireResolution,
   unobservedContext,
   observedContext,
   observedProgress,
   throwingContext,
   httpTransport,
   operatingPolicy,
   sdkStream,
   receiptControl,
   providerMetadata
 }=settings;
 const {
   assessments,
   executions,
   requests,
   httpCalls,
   contextCalls,
   lateContextMutations,
   progressCalls
 }=measures;
 const expectedExecutions=settings.expectedExecutions??3;
 if(!review){
  try{judgment?.assertDependenciesCurrent();}
  catch(error){console.error(inspect(
    error,
    {
      depth:8,
      maxStringLength:2_048
    }
  ));}
  try{assertNativeSessionInputCapture(env.readActiveSessionManager(session));}
  catch(error){console.error(inspect(
    error,
    {
      depth:6,
      maxStringLength:2_048
    }
  ));}
  try{env.readActiveSessionRunComposition(session);}
  catch(error){console.error(inspect(
    error,
    {
      depth:6,
      maxStringLength:2_048
    }
  ));}
 }
 assert.ok(
   review,
   inspect(
   {
     requests,
     assessments,
     executions,
     progressCalls,
     message:session.messages
       .at(-1),
     toolErrors:session.messages
       .filter(function failedTool(message){return (message.role==='toolResult')&&message.isError;}),
     judgment:judgment?.inspect()
   },
   {depth:4}
 )
 );
 const clauseAbstention=assertDomainTransport({review,settings,originalBody});
 const issues=review.premiseIssues
   .map(function describeUnresolvedIssue(issue) { return (({
     premise:issue.premise,
     kind:issue.kind,
     reason:issue.reason
   })); });
 const result={
   complete:true,
   relation,
   providerMetadata,
   outcome:review.outcome,
   issues,
   sources:review.inputs
     .instructionSources
     .length,
   clauses:review.clauseInterpretations
     .length,
   requestUses:review.requestSourceAssociationUses
     .map(function readContributionState(use) { return (use.state); }),
   requests,
   assessments,
   httpCalls,
   executions,
   progressCalls,
   providerRequests:0,
   productionPolicyAdopted:operatingPolicy,
   empiricalQualificationEstablished:false,
   clauseAbstention
 };
 assert.equal(
   httpCalls,
   httpTransport?assessments:0
 );
 const domainIssue=review.premiseIssues
   .find(function isNativeDomainIssue(issue) { return (issue.kind==='request-source-domain'); });
 if(unobservedContext){
  assert.ok(
    contextCalls>0,
    'The native context callback must actually run'
  );
  assert.ok(domainIssue?.sourceDomain
    .gaps
    .some(function namesUnobservedContext(gap) { return (gap.reason
      .includes('"input"')); }));
  assert.equal(
    review.outcome
      .state,
    'unresolved'
  );
  assert.equal(
    executions,
    0
  );
 }else{
  assert.ok(
    domainIssue===undefined,
    `Original native event accounting is incomplete: ${JSON.stringify(domainIssue?.sourceDomain
      ?.gaps)}`
  );
  if(observedContext)assertObservedDomainContext({review,contextCalls,throwingContext,lateContextMutations});
  if(receiptControl){
   assert.equal(
     review.outcome
       .state,
     'unresolved'
   );assert.equal(
     executions,
     0
   );
   const failedContributions=review.inputs
     .requestObservation
     .sourceContributions
     .filter(function selectedContribution(value){return alteredContribution({
       control:receiptControl,
       location:value.location
     });});
   assert.ok(failedContributions.length>0);
   assert.ok(
     failedContributions.every(function namesMissingSerializerOccurrence(value) { return (value.reason
       ?.includes(value.location
         .field
         ==='tools'?'original native declaration emission':receiptControl==='copied-system'?'original native rendering and message emission':'original native serializer occurrence')); }),
     inspect(
     review.inputs
       .requestObservation
       .sourceContributions,
     {depth:3}
   )
   );
  }else if(clauseAbstention){
   assert.equal(
     review.outcome
       .state,
     'unresolved'
   );
   assert.equal(
     executions,
     0
   );
   assert.ok(review.premiseIssues
     .some(function unresolvedMeaning(issue){return issue.premise==='qualified-rule-interpretation';}));
  }else{
   assert.equal(
     review.outcome
       .state,
     relation==='none'?'unspecified':'resolved'
   );
   if(relation!=='none')assert.equal(
     review.outcome
       .verdict,
     relation==='permission'?'approve':'deny'
   );
   if(executions!==(relation==='permission'?expectedExecutions:0))console.log(inspect(
     {
       toolResults:session.messages
         .filter(function isToolResultMessage(message) { return (message.role==='toolResult'); }),
       judgment:judgment?.inspect()
     },
     {depth:6}
   ));
   assert.equal(
     executions,
     relation==='permission'?expectedExecutions:0
   );
  }
  if(requireResolution)assertCompleteDomainResolution(review);
  if(observedProgress)assert.ok(
    progressCalls>0,
    'The original progress callback must run at the native execution boundary'
  );
 }
 console.log(JSON.stringify({
   ...result,
   unobservedContext,
   observedContext,
   throwingContext,
   lateContextMutations,
   contextCalls,
   sdkStream,
   receiptControl
 }));

}

//endregion Native review assertions retain every authored contrast and original domain control
