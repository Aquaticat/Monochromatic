import {readPolicyInput} from './system-slot.mjs';
import {GoverningPolicyBindingError} from './governing-source.mjs';

/** Bind each retained processing receipt through its original loader-owned collection. */
export function bindResourceReceiptSources({
  policyInput,
  governing
}){
 const input=readPolicyInput(policyInput);
 const {request} = governing.view;
 const snapshot=governing.view
   .sources
   ??request.sources; const sources=input.resourceReceiptInputs;
 governing.assertCurrent(governing.view);
 if(snapshot.resourceReceiptInputs!==sources)throw new GoverningPolicyBindingError('Resource receipts are not the original loader-owned collection');
 return sources.map(source=>{
  if((source.kind!=='native-resource-received-input')||(source.resourceInputOccurrence===undefined)
    ||(!snapshot.governingSources
      .includes(source)))throw new GoverningPolicyBindingError('Resource receipt differs from its original governing-source membership');
  const view=Object.freeze({
    kind:'original-resource-receipt-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    resourceInputOccurrence:source.resourceInputOccurrence,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Resource receipt view is not its original binding');
   governing.assertCurrent(governing.view);
   if(readPolicyInput(policyInput)!==input)throw new GoverningPolicyBindingError('Original resource receipt collection changed');
  }
  assertCurrent(view);
  return Object.freeze({
    view,
    authority:undefined,
    assertCurrent
  });
 });
}
