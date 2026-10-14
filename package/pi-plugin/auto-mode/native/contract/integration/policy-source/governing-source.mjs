import {
  readPolicyInput,
  assertPolicyInput
} from './system-slot.mjs';

export class GoverningPolicyBindingError extends Error {
 constructor(
   message,
   options
 ){super(
   message,
   options
 );this.name=this.constructor
   .name;}
}

/**
 Bind the bootstrap-selected capture to the judgment's owned sources and unchanged original request.
 Governing authority need not be inferred from, or forced into, a prompt carrier.
 The collector remains responsible for original snapshot ownership and freshness.
 */
export function bindGoverningPolicySource({
  policyInput,
  judgment,
  producerOwner,
  observer,
  collector,
  response,
  stream
}){
 const link=readPolicyInput(policyInput);
   const receipt=observer.observationFor(response);
 let failure;
 let sources;
 function current(){
  if(failure)throw new GoverningPolicyBindingError(
    'Original governing source lost eligibility',
    {cause:failure.cause}
  );
  try{
   if(producerOwner.judgmentFor({
     response,
     stream
   })!==judgment)throw new GoverningPolicyBindingError('Governing source belongs to another original judgment');
   producerOwner.assertMainAgentResponse({
     response,
     stream
   });
   const currentSources=judgment.readSourceSnapshot?.()??judgment.sourceSnapshot??receipt.sources;
   if(sources===undefined)sources=currentSources;
   else if(sources!==currentSources)throw new GoverningPolicyBindingError('Original judgment source snapshot changed');
   observer.assertFresh(receipt);collector.assertObservedFresh(sources);
   judgment.assertDependenciesCurrent();assertPolicyInput({
     input:policyInput,
     binding:link
   });
  }catch(error){failure={cause:error};throw error;}
 }
 current();judgment.checkpoint();
 if((sources.hostGoverningPolicy!==link.source)||(sources.resourceInputObservation!==link.frame))throw new GoverningPolicyBindingError('Judgment does not retain the original selected governing capture and resource frame');
 const view=Object.freeze({
   kind:'original-governing-source-view',
   source:link.source,
   sourceOccurrence:link.source
     .occurrence,
   request:receipt,
   sources,
   authority:'not-established',
   priority:'not-established',
   completeGoverningCoverage:false,
   permission:false
 });
 current();judgment.checkpoint();
 function assertCurrent(value){
  if(value!==view)throw new GoverningPolicyBindingError('Governing view is not the original source binding');
  current();
 }
 return Object.freeze({
   view,
   assertCurrent
 });
}
