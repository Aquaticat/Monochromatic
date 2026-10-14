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
  .includes('--unobserved-context');
const sdkStream=process.argv
  .includes('--sdk-stream');
const receiptControl=process.argv
  .includes('--copied-payload')?'copied-payload':process.argv
  .includes('--copied-transcript')?'copied-transcript':undefined;
assert.ok((!receiptControl)||sdkStream,'Serializer receipt controls exercise the normal SDK stream');
let contextCalls=0;
const env=await createEnvironment({
  policyText:'RUL:\n '+text+'\n',
  hostPrompt:'Fixture background.',
  useNativeProvider:sdkStream,
  extensionFactories:unobservedContext?[function registerUnobservedContextHandler(pi) {pi.on('context',function countUnobservedContextCall() {contextCalls++;});}]:[]
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
  async sendWire({body}){
  assessments++;const wire=JSON.parse(body);assert.equal(wire.state.originalRequestBody,originalBody);
  const answers=Object.fromEntries(Object.entries(wire.questions).map(function answerAuthoredDomainQuestion([slot,question]) {
   const choice=question.instructions.selectedMaterial==='originalRequestBody'?requestRelation:question.instructions.selectedRule?.id==='RUL'?relation:'none';
   assert(Object.hasOwn(question.criteria,choice));
   return [slot,{type:'choice',choice,probabilities:Object.fromEntries(Object.keys(question.criteria).map(function scoreAuthoredDomainChoice(label) { return ([label,label===choice?1:0]); }))}];
  }));
  return JSON.stringify({model:wire.model,answers,usage:{input_tokens:100,output_tokens:10}});
 },
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
   executions,
   providerRequests:0,
   productionPolicyAdopted:false
 };
 const domainIssue=review.premiseIssues
   .find(function isNativeDomainIssue(issue) { return (issue.kind==='request-source-domain'); });
 if(unobservedContext){
  assert.ok(contextCalls>0,'The native context callback must actually run');
  assert.ok(domainIssue?.sourceDomain
    .gaps
    .some(function namesUnobservedContext(gap) { return (gap.reason.includes('"context"')); }));
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
      snapshot:{...input.snapshot,nativeDomainEventKinds:['context']}
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
   contextCalls,
   sdkStream,
   receiptControl
 }));

}finally{session.dispose();await session.agent
  .waitForIdle();runtime.detach();await env.drain();}
