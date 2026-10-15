import {
  readAuthorityRegistration,
  readPolicyInput
} from './system-slot.mjs';
import {
  bindGoverningPolicySource,
  GoverningPolicyBindingError
} from './governing-source.mjs';
import {bindRunMessageSources} from './run-messages.mjs';
import {bindRetainedRunSources} from './run-history.mjs';
import {bindResourceReceiptSources} from './resource-receipt-bindings.mjs';

import {bindHostPromptSource,bindResourceSystemSource,bindAppendPromptSources,bindContextPromptSources} from './resource-prompt-bindings.mjs';
import {bindForcedPromptSource,bindRunGuidelineSources,bindMappedPromptSources} from './run-prompt-bindings.mjs';
import {bindSkillDescriptionSources,bindBuiltInPromptSources,bindResourceToolSources} from './generated-prompt-bindings.mjs';

/**
 Bind the startup authority declaration to a proven original source/request link.
 The declaration supplies policy; the view supplies custody. Neither supplies
 rule meaning, delegation, complete governing coverage or execution permission.
 */
export function bindRegisteredPolicy(context){
 const {policyInput}=context;
 const source=bindGoverningPolicySource(context);
 const registration=readAuthorityRegistration(policyInput);
 const host=bindHostPromptSource({
   policyInput,
   governing:source
 });
 const resourceSystem=bindResourceSystemSource({
   policyInput,
   governing:source
 });
 const appended=bindAppendPromptSources({
   policyInput,
   governing:source
 });
 const contextSources=bindContextPromptSources({
   policyInput,
   governing:source
 });
 const instructionCarriers=readPolicyInput(policyInput)
   .contextCarriers;
 const runInstructionCarriers=source.view
   .request
   .sources
   .runInputCarriers
   ??Object.freeze([]);
 const forced=bindForcedPromptSource({governing:source});
 const guidelines=bindRunGuidelineSources({governing:source});
 const mapped=bindMappedPromptSources({governing:source});
 const skills=bindSkillDescriptionSources({governing:source});
 const messages=bindRunMessageSources({governing:source});
 const builtIn=bindBuiltInPromptSources({governing:source});
 const resourceTools=bindResourceToolSources({governing:source});
 const resourceReceipts=bindResourceReceiptSources({
   policyInput,
   governing:source
 });
 const retainedRuns=bindRetainedRunSources({governing:source});
 const additionalSources=Object.freeze([
   ...retainedRuns,
   ...resourceReceipts,
   ...(host?[host]:[]),
   ...(resourceSystem?[resourceSystem]:[]),
   ...appended,
   ...contextSources,
   ...(forced?[forced]:[]),
   ...guidelines,
   ...mapped,
   ...skills,
   ...messages,
   ...builtIn,
   ...resourceTools
 ]);
 /** Validate each local binding between fresh reads of their common original parent. */
 function assertAllCurrent(){
  source.assertCurrent(source.view);
  for(const binding of additionalSources){
   binding.assertBindingIdentity(binding.view);
   if(binding.authority)binding.assertAuthorityCurrent(binding.authority);
  }
  if(readAuthorityRegistration(policyInput)!==registration)throw new GoverningPolicyBindingError('Original startup authority registration changed');
  source.assertCurrent(source.view);
 }
 if(!registration)return Object.freeze({
   ...source,
   authority:undefined,
   additionalSources,
   assertAllCurrent,
   instructionCarriers,
   runInstructionCarriers
 });
 const authority=Object.freeze({
   kind:'registered-instruction-authority',
   registration,
   sourceOccurrence:source.view
     .sourceOccurrence,
   tier:registration.tier,
   priority:registration.priority,
   scope:Object.freeze({
     kind:registration.scope,
     request:source.view
       .request
   }),
   completeGoverningCoverage:false,
   permission:false
 });
 function assertAuthorityCurrent(value){
  if(value!==authority)throw new GoverningPolicyBindingError('Authority is not this original startup registration binding');
  source.assertCurrent(source.view);
  if(readAuthorityRegistration(policyInput)!==registration)throw new GoverningPolicyBindingError('Original startup authority registration changed');
 }
 assertAuthorityCurrent(authority);
 return Object.freeze({
   ...source,
   authority,
   assertAuthorityCurrent,
   additionalSources,
   assertAllCurrent,
   instructionCarriers,
   runInstructionCarriers
 });
}
