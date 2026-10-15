import {bindNativePolicyRuntime} from './runtime.mjs';
import {nativeOpenAIStream} from './source-association.mjs';
import {fixtureResponse} from './fixture-response.mjs';
import {ruleAssessmentModel} from '../action-policy/wire.mjs';
import {createNativeSemanticOperatingPolicies} from '../maintained-policy.mjs';
import {createDomainFixtureStream} from './domain-fixture-stream.mjs';
import {createDomainFixtureAssessment} from './domain-fixture-assessment.mjs';

//region Original native runtime owns the authored assessment and transport callbacks.
export function createDomainFixtureRuntime({settings,observations,env,session,root,lifecycle,code,programProfile}){
 const {unconfiguredPolicies,operatingPolicy,sdkStream,nextDecision,providerMetadata,receiptControl}=settings;
function policy(definitionId) { return {
  model:ruleAssessmentModel,
  definitionId,
  programProfile,
  accepts:function acceptAuthoredDomainRelation() { return (true); }
}; }
 const controlledSdkStream=createDomainFixtureStream({session,providerMetadata,receiptControl});
 const sendAssessment=createDomainFixtureAssessment({settings,observations});
const runtime=bindNativePolicyRuntime({
  root,
  lifecycle,
  policyInput:env.policyInput,
  endpoint:'https://fixture.invalid/v1/chat/completions',
  rootDirectory:env.options
    .cwd,
  parsePolicy:env.parser
    .parse,
  files:[],
  wrapToolDefinition:env.wrapToolDefinition,
  readSessionDisposalState:env.readSessionDisposalState,
  trace(){return undefined;},
  ...(unconfiguredPolicies?{}:operatingPolicy?createNativeSemanticOperatingPolicies():{
   semanticAdmissionPolicy:policy('clause_operation_relation'),
   headingContextAdmissionPolicy:policy('heading_instruction_content')
  }),
  sendWire(input){
   if(observations.failAssessment){observations.assessments++;throw new Error('Fixture assessment unavailable');}
   return sendAssessment(input);
  },
  ...(unconfiguredPolicies?{send(){observations.assessments++;throw new Error('An unconfigured semantic consumer must not dispatch an assessment');}}:{}),
  originalStream:sdkStream?function stream(
    model,
    context,
    options
  ){return controlledSdkStream({
    model,
    context,
    options
  });}:nativeOpenAIStream,
  async terminalFetch(
    input,
    init
  ){
   if(observations.warmingUp)return fixtureResponse({proposal:false});
   observations.requests++;
   if(nextDecision&&(observations.requests===2))observations.firstDecision={
     ...runtime.inspect(),
     measures:{...observations}
   };
   const proposal=(observations.requests===1)||(nextDecision&&(observations.requests===2));
   if(proposal)observations.originalBody=init.body;
   return fixtureResponse({
     proposal,
     code
   });
  }
});
 return runtime;
}
//endregion
