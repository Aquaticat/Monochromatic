import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {inspectNativeSourceDomain} from '../policy-source/source-domain.mjs';
import {assertNativeSessionInputCapture} from './generated/session-manager.mjs';

/** Each receipt contrast invalidates only its actual transport field and position. */
function alteredContribution({control,location}){
 if(control==='copied-system')return location.field==='messages'&&location.ordinal===0;
 if(control==='copied-tools')return location.field==='tools';
 if(control==='copied-tool'||control==='changed-tool')return location.field==='tools'&&location.ordinal===0;
 return Boolean(control);
}

//region Native review assertions retain every authored contrast and original domain control

/** Verify the observed decision and execution against this fixture's original selected contrasts. */
export function assertDomainReview({env,review,judgment,session,originalBody,settings,measures}){
 const {relation,requireResolution,unobservedContext,observedContext,observedProgress,throwingContext,httpTransport,operatingPolicy,lowConfidenceClause,unresolvedClause,sdkStream,receiptControl,providerMetadata}=settings;
 const {assessments,executions,requests,httpCalls,contextCalls,lateContextMutations,progressCalls}=measures;
 const expectedExecutions=settings.expectedExecutions??3;
 if(!review){
  try{judgment?.assertDependenciesCurrent();}
  catch(error){console.error(inspect(error,{depth:8,maxStringLength:2048}));}
  try{assertNativeSessionInputCapture(env.readActiveSessionManager(session));}
  catch(error){console.error(inspect(error,{depth:6,maxStringLength:2048}));}
  try{env.readActiveSessionRunComposition(session);}
  catch(error){console.error(inspect(error,{depth:6,maxStringLength:2048}));}
 }
 assert.ok(review,inspect(
   {requests,assessments,executions,progressCalls,message:session.messages.at(-1),toolErrors:session.messages.filter(function failedTool(message){return message.role==='toolResult'&&message.isError;}),judgment:judgment?.inspect()},
   {depth:4}
 ));
 assert.equal(
   review.inputs.requestObservation.request.body,
   originalBody
 );
 assert.equal(Object.hasOwn(review,'requestMaterialInterpretation'),false);
 assert.equal(Object.hasOwn(review,'requestGoverningUse'),false);
 assert.equal(Object.hasOwn(review.inputs.requestObservation,'sourceDerivation'),false);
 assert.equal(Object.hasOwn(review.inputs.requestObservation,'sourceDerivationFailure'),false);
 assert.ok(review.premiseIssues.every(function toolCallPremise(issue){return !['request-material-instruction-use','request-material-interpretation'].includes(issue.kind);}));
 if(providerMetadata){
  const request=JSON.parse(originalBody);
  if(providerMetadata==='thinking')assert.deepEqual(request.thinking,{type:'enabled'});
  else assert.deepEqual(request.fixture_provider_option,{value:'extension metadata'});
 }
 const clauseAbstention=lowConfidenceClause||unresolvedClause!==undefined;
 if(clauseAbstention){
  assert.equal(review.clauseInterpretations.filter(function abstained(clause){return clause.admission==='abstained';}).length,1);
 }else assert.ok(review.clauseInterpretations
   .every(function isAdmittedClause(clause) { return (clause.admission==='admitted'); }));
 assert.ok(review.headingContextInterpretations
   .every(function isAdmittedNonInstructionHeading(heading) { return (heading.admission==='admitted'&&heading.relation==='none'); }));
 if(sdkStream){
  assert.ok(review.requestSourceAssociationUses
    .length
    >0,'The normal SDK route must retain original native serializer contributions');
  assert.ok(review.requestSourceAssociationUses
    .every(function matchesExpectedContributionState(use) { return (use.state===(alteredContribution({control:receiptControl,location:use.location})?'unresolved':'accounted')); }),inspect(
    review.requestSourceAssociationUses,
    {depth:3}
  ));
 }
 if(sdkStream&&!receiptControl&&!observedContext&&!unobservedContext){
  const systemContributions=review.inputs.requestObservation.sourceContributions.filter(function originalSystemDerivation(value){return value.systemDerivation!==undefined;});
  assert.ok(systemContributions.length>0,'The normal native serializer must retain its original system input derivation');
  const derivation=systemContributions[0].systemDerivation;
  assert.ok(derivation.associations.length>0);
  for(const association of derivation.associations){
   assert.ok(association.systemInputPublication,'System derivation must use the original manager input publication');
   assert.ok(systemContributions.some(function originalSystemAssociation(value){return value.association===association;}),
    'Every original system derivation input must reach contribution consumption');
  }
 }
 const issues=review.premiseIssues
   .map(function describeUnresolvedIssue(issue) { return (({premise:issue.premise,kind:issue.kind,reason:issue.reason})); });
 const result={
   complete:true,
   relation,
   providerMetadata,
   outcome:review.outcome,
   issues,
   sources:review.inputs.instructionSources.length,
   clauses:review.clauseInterpretations.length,
   requestUses:review.requestSourceAssociationUses.map(function readContributionState(use) { return (use.state); }),
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
 assert.equal(httpCalls,httpTransport?assessments:0);
 const domainIssue=review.premiseIssues
   .find(function isNativeDomainIssue(issue) { return (issue.kind==='request-source-domain'); });
 if(unobservedContext){
  assert.ok(contextCalls>0,'The native context callback must actually run');
  assert.ok(domainIssue?.sourceDomain
    .gaps
    .some(function namesUnobservedContext(gap) { return (gap.reason.includes('"input"')); }));
  assert.equal(
    review.outcome.state,
    'unresolved'
  );
  assert.equal(
    executions,
    0
  );
 }else{
  assert.ok(
    domainIssue===undefined,
    `Original native event accounting is incomplete: ${JSON.stringify(domainIssue?.sourceDomain?.gaps)}`
  );
  if(observedContext){
   assert.ok(contextCalls>=3,'Original native context and context_with_system callbacks must run');
   const receipts=review.inputs.instructionSources.map(function readContextSource(view) { return view.source; })
    .filter(function isContextReceipt(source) { return source.inputOrigin==='native-context-handler'; });
   assert.equal(receipts.length,throwingContext?7:8,'Every original callback input, mutated input, and defined result needs its own retained source');
   assert.ok(receipts.some(function retainsInPlaceInput(source) { return source.content.includes('Original in-place context input'); }));
   if(throwingContext)assert.ok(receipts.some(function retainsInputBeforeFailure(source){return source.content.includes('Original input mutation before context failure');}));
   else{
    assert.ok(lateContextMutations>0,'The later queued native result mutation must actually run');
    assert.ok(receipts.some(function retainsUnusedResult(source) { return source.content.includes('Original unselected context result'); }));
   }
   assert.ok(receipts.some(function retainsUnusedSystemResult(source) { return source.content.includes('Original unselected system context result'); }));
   assert.ok(receipts.every(function leavesContextAuthorityUnestablished(source) { return source.permission===false&&source.registration===undefined; }));
   const snapshot=review.inputs.instructionSources[0].sources;
   const input={snapshot,instructionSources:review.inputs.instructionSources,sourceCoverage:review.inputs.ruleSourceCoverage};
   for(const receipt of [undefined,{...snapshot.nativeRunComposition.contextHandlerReceipt,runOccurrence:Object.freeze({})}]){
    const gaps=inspectNativeSourceDomain({...input,snapshot:{...snapshot,nativeRunComposition:{...snapshot.nativeRunComposition,contextHandlerReceipt:receipt}}}).gaps;
    assert.ok(gaps.some(function missingOriginalCompletion(gap){return gap.reason.includes('"context"');}),'Missing or substituted original context completion must keep the source domain unresolved');
   }
  }
  if(receiptControl){
   assert.equal(
     review.outcome.state,
     'unresolved'
   );assert.equal(
     executions,
     0
   );
   const failedContributions=review.inputs
     .requestObservation
     .sourceContributions
     .filter(function selectedContribution(value){return alteredContribution({control:receiptControl,location:value.location});});
   assert.ok(failedContributions.length>0);
   assert.ok(failedContributions.every(function namesMissingSerializerOccurrence(value) { return (value.reason?.includes(value.location.field==='tools'?'original native declaration emission':receiptControl==='copied-system'?'original native rendering and message emission':'original native serializer occurrence')); }),inspect(
     review.inputs.requestObservation.sourceContributions,
     {depth:3}
   ));
  }else if(clauseAbstention){
   assert.equal(review.outcome.state,'unresolved');
   assert.equal(executions,0);
   assert.ok(review.premiseIssues.some(function unresolvedMeaning(issue){return issue.premise==='qualified-rule-interpretation';}));
  }else{
   assert.equal(
     review.outcome.state,
     relation==='none'?'unspecified':'resolved'
   );
   if(relation!=='none')assert.equal(
     review.outcome.verdict,
     relation==='permission'?'approve':'deny'
   );
   if(executions!==(relation==='permission'?expectedExecutions:0))console.log(inspect(
     {toolResults:session.messages.filter(function isToolResultMessage(message) { return (message.role==='toolResult'); }),judgment:judgment?.inspect()},
     {depth:6}
   ));
   assert.equal(
     executions,
     relation==='permission'?expectedExecutions:0
   );
  }
  if(requireResolution){
   // Audit retained immutable evidence; the completed request is no longer eligible for live use.
   const input={
     snapshot:review.inputs.instructionSources[0].sources,
     instructionSources:review.inputs.instructionSources,
     sourceCoverage:review.inputs.ruleSourceCoverage
   };
   assert.equal(
     inspectNativeSourceDomain(input).gaps.length,
     0
   );
   const altered=[
    {
      ...input,
      snapshot:{...input.snapshot,governingSources:input.snapshot.governingSources.slice(1)}
    },
    {
      ...input,
      instructionSources:input.instructionSources.slice(1)
    },
    {
      ...input,
      sourceCoverage:input.sourceCoverage.slice(1)
    },
    {
      ...input,
      snapshot:{...input.snapshot,resourceReceiptInputs:[]}
    },
    {
      ...input,
      snapshot:{...input.snapshot,nativeDomainEventKinds:undefined}
    },
    {
      ...input,
      snapshot:{...input.snapshot,nativeDomainEventKinds:['turn_start']}
    }
   ];
   for(const incomplete of altered)assert.ok(inspectNativeSourceDomain(incomplete)
     .gaps
     .length
     >0,'Removing original receipt or membership evidence must keep the domain unresolved');
  }
  if(observedProgress)assert.ok(progressCalls>0,'The original progress callback must run at the native execution boundary');
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
