import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.mjs';
import {bindNativePolicyRuntime} from './runtime.mjs';
import {createOwnedCodemodeDefinition} from "./generated/program-definition.mjs";
import {nativeOpenAIStream} from './source-association.mjs';
import {fixtureResponse} from './fixture-response.mjs';
import {ruleAssessmentModel} from '../action-policy/wire.mjs';
import {inspectNativeSourceDomain} from '../policy-source/source-domain.mjs';
import {createAssessmentSender} from '../maintained-policy.mjs';

const relation=process.argv[2]??'prohibition',
  requireResolution=process.argv
  .includes('--require-resolution'),requestRelation=process.argv
  .includes('--request-potential')?'potential-instruction':'none';
assert.ok([
  'permission',
  'prohibition',
  'none'
].includes(relation));
const text={
  permission:'The complete proposed operation is permitted.',
  prohibition:'The complete proposed operation is prohibited.',
  none:'Use sentence case in the final response.'
}[relation];
const unobservedContext=process.argv
  .includes('--unobserved-event');
const observedContext=process.argv.includes('--observed-context');
const throwingContext=process.argv.includes('--throwing-context');
const httpTransport=process.argv.includes('--http-transport');
assert.ok(!throwingContext||observedContext,'Throwing context controls require the observed native context route');
const sdkStream=process.argv
  .includes('--sdk-stream');
const receiptControl=process.argv
  .includes('--copied-payload')?'copied-payload':process.argv
  .includes('--copied-transcript')?'copied-transcript':undefined;
assert.ok((!receiptControl)||sdkStream,'Serializer receipt controls exercise the normal SDK stream');
let contextCalls=0;
let lateContextMutations=0;
const env=await createEnvironment({
  policyText:'RUL:\n '+text+'\n',
  hostPrompt:'Fixture background.',
  useNativeProvider:sdkStream,
  extensionFactories:unobservedContext?[function registerUnobservedContextHandler(pi) {pi.on('turn_start',function countUnobservedContextCall() {contextCalls++;});}]:observedContext?[function registerObservedContextHandlers(pi) {
   pi.on('context',function retainOriginalContextInput(event) {
    contextCalls++;
    event.receiptFixture='Original in-place context input';
   });
   pi.on('context',function retainOriginalContextResult(event) {
    contextCalls++;
    if(throwingContext){
     event.receiptFixture='Original input mutation before context failure';
     throw new Error('Expected original context callback failure');
    }
    const result={messages:event.messages,unusedInstruction:'Original unselected context result'};
    const deferred=Promise.withResolvers();
    queueMicrotask(function settleOriginalContextResult(){
     deferred.resolve(result);
     queueMicrotask(function mutateAfterOriginalContextSettlement(){
      result.unusedInstruction='Later queued context result mutation';
      lateContextMutations++;
     });
    });
    return deferred.promise;
   });
   pi.on('context_with_system',function retainOriginalSystemContextResult(event) {
    contextCalls++;
    return {messages:event.messages,unusedInstruction:'Original unselected system context result'};
   });
  }]:[]
});
let assessments=0,executions=0,originalBody,requests=0;
const leaf={
  ...env.createReadToolDefinition(env.options.cwd),
  name:'fixture_value',
  description:'Returns fixture text without accessing files.',
  async execute(){executions++;return {content:[{type:'text',text:'fixture child value'}],details:{}};}
};
const {
  session,
  root,
  lifecycle
}=await createRootSessionFactory(env)
  .create({options:{...env.options,tools:['codemode','fixture_value'],customTools:[createOwnedCodemodeDefinition(),leaf]}});
session.agent
  .getApiKey=function readDomainFixtureApiKey() { return (process.env
  .FIXTURE_API_KEY); };
const code='const value = await tools.fixture_value({path:"seed"});\nreturn await Promise.allSettled([tools.fixture_value({path:value}),tools.fixture_value({path:"second"})]);',programProfile='awaited-string-result-then-literal-parallel';
function policy(definitionId) { return {model:ruleAssessmentModel,definitionId,programProfile,accepts:function acceptAuthoredDomainRelation() { return (true); }}; }
const originalSdkStream=session.agent
  .streamFunction;
function controlledSdkStream(
  model,
  context,
  options
){
 if(receiptControl==='copied-transcript')return originalSdkStream(
   model,
   {...context,messages:[...context.messages]},
   options
 );
 if(receiptControl==='copied-payload')return originalSdkStream(
   model,
   context,
   {...options,
  onPayload(payload,selectedModel){return options.onPayload(structuredClone(payload),selectedModel);}
 }
 );
 return originalSdkStream(
   model,
   context,
   options
 );
}
function authoredWireAnswer({body}){
  assessments++;const wire=JSON.parse(body);assert.equal(wire.state.originalRequestBody,originalBody);
  const answers=Object.fromEntries(Object.entries(wire.questions).map(function answerAuthoredDomainQuestion([slot,question]) {
   const choice=question.instructions.selectedMaterial==='originalRequestBody'?requestRelation:question.instructions.selectedRule?.id==='RUL'?relation:'none';
   assert(Object.hasOwn(question.criteria,choice));
   return [slot,{type:'choice',choice,probabilities:Object.fromEntries(Object.keys(question.criteria).map(function scoreAuthoredDomainChoice(label) { return ([label,label===choice?1:0]); }))}];
  }));
  return JSON.stringify({model:wire.model,answers,usage:{input_tokens:100,output_tokens:10}});
}
let httpCalls=0;
const sendAssessment=httpTransport?createAssessmentSender({
 now:function originalAssessmentClock(){return performance.now();},
 readCredential:function fixtureAssessmentCredential(){return 'native-http-fixture-key';},
 async fetchImpl(url,options){
  httpCalls++;
  assert.equal(url,'https://api.llmgateway.io/v1/systemone');
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.authorization,'Bearer native-http-fixture-key');
  assert.equal(options.signal.aborted,false);
  return new Response(authoredWireAnswer({body:options.body}));
 }
}):authoredWireAnswer;
const runtime=bindNativePolicyRuntime({
  root,
  lifecycle,
  policyInput:env.policyInput,
  endpoint:'https://fixture.invalid/v1/chat/completions',
  rootDirectory:env.options.cwd,
  parsePolicy:env.parser.parse,
  files:[],
  wrapToolDefinition:env.wrapToolDefinition,
  readSessionDisposalState:env.readSessionDisposalState,
  trace(){},
  semanticAdmissionPolicy:policy('clause_operation_relation'),
  requestMaterialAdmissionPolicy:policy('request_instruction_content'),
  headingContextAdmissionPolicy:policy('heading_instruction_content'),
  effectOwnerFor:function omitDomainAuthorizationOwner() { return (undefined); },
  sendWire:sendAssessment,
  originalStream:sdkStream?controlledSdkStream:nativeOpenAIStream,
  async terminalFetch(input,init){requests++;if(requests===1)originalBody=init.body;return fixtureResponse({proposal:requests===1,code});}
});
try{
 await session.prompt('Exercise the original request-specific policy domain.');
 const {
   lastReview:review,
   lastJudgment:judgment
 }=runtime.inspect();
 assert.ok(review,inspect(
   {requests,assessments,message:session.messages.at(-1),judgment:judgment?.inspect()},
   {depth:4}
 ));
 assert.equal(
   review.inputs.requestObservation.request.body,
   originalBody
 );
 assert.equal(
   review.requestMaterialInterpretation.admission,
   'admitted'
 );assert.equal(
   review.requestMaterialInterpretation.relation,
   requestRelation
 );
 assert.ok(review.clauseInterpretations
   .every(function isAdmittedClause(clause) { return (clause.admission==='admitted'); }));
 assert.ok(review.headingContextInterpretations
   .every(function isAdmittedNonInstructionHeading(heading) { return (heading.admission==='admitted'&&heading.relation==='none'); }));
 if(sdkStream){
  assert.ok(review.requestSourceAssociationUses
    .length
    >0,'The normal SDK route must retain original native serializer contributions');
  assert.ok(review.requestSourceAssociationUses
    .every(function matchesExpectedContributionState(use) { return (use.state===(receiptControl?'unresolved':'accounted')); }),inspect(
    review.requestSourceAssociationUses,
    {depth:3}
  ));
 }
 const issues=review.premiseIssues
   .map(function describeUnresolvedIssue(issue) { return (({premise:issue.premise,kind:issue.kind,reason:issue.reason})); });
 const result={
   complete:true,
   relation,
   requestRelation,
   outcome:review.outcome,
   issues,
   sources:review.inputs.instructionSources.length,
   clauses:review.clauseInterpretations.length,
   requestUses:review.requestSourceAssociationUses.map(function readContributionState(use) { return (use.state); }),
   requests,
   assessments,
   httpCalls,
   executions,
   providerRequests:0,
   productionPolicyAdopted:false
 };
 assert.equal(httpCalls,httpTransport?assessments:0);
 const domainIssue=review.premiseIssues
   .find(function isNativeDomainIssue(issue) { return (issue.kind==='request-source-domain'); });
 if(unobservedContext){
  assert.ok(contextCalls>0,'The native context callback must actually run');
  assert.ok(domainIssue?.sourceDomain
    .gaps
    .some(function namesUnobservedContext(gap) { return (gap.reason.includes('"turn_start"')); }));
  assert.equal(
    review.outcome.state,
    'unresolved'
  );
  assert.equal(
    executions,
    0
  );
 }else{
  assert.equal(
    domainIssue,
    undefined,
    'The original host domain needs code-owned decision-specific accounting, not an unconditional domain hold'
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
   assert.ok(review.inputs
     .requestObservation
     .sourceContributions
     .every(function namesMissingSerializerOccurrence(value) { return (value.reason?.includes('original native serializer occurrence')); }),inspect(
     review.inputs.requestObservation.sourceContributions,
     {depth:3}
   ));
  }else if(requestRelation!=='none'){
   assert.equal(
     review.outcome.state,
     'unresolved'
   );assert.equal(
     executions,
     0
   );
   assert.ok(review.premiseIssues
     .some(function isRequestInstructionIssue(issue) { return (issue.kind==='request-material-instruction-use'); }));
  }else{
   assert.equal(
     review.outcome.state,
     relation==='none'?'unspecified':'resolved'
   );
   if(relation!=='none')assert.equal(
     review.outcome.verdict,
     relation==='permission'?'approve':'deny'
   );
   if(executions!==(relation==='permission'?3:0))console.log(inspect(
     {toolResults:session.messages.filter(function isToolResultMessage(message) { return (message.role==='toolResult'); }),judgment:judgment?.inspect()},
     {depth:6}
   ));
   assert.equal(
     executions,
     relation==='permission'?3:0
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

}finally{session.dispose();await session.agent
  .waitForIdle();runtime.detach();await env.drain();}
