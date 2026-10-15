import assert from 'node:assert/strict';
import {inspectNativeSourceDomain} from '../policy-source/source-domain.mjs';

//region Context callbacks retain original inputs, results, failures, and completion identity.
export function assertObservedDomainContext({review,contextCalls,throwingContext,lateContextMutations}){
   assert.ok(
     contextCalls>=3,
     'Original native context and context_with_system callbacks must run'
   );
   const receipts=review.inputs
     .instructionSources
     .map(function readContextSource(view) { return view.source; })
     .filter(function isContextReceipt(source) { return source.inputOrigin==='native-context-handler'; });
   assert.equal(
     receipts.length,
     throwingContext?7:8,
     'Every original callback input, mutated input, and defined result needs its own retained source'
   );
   assert.ok(receipts.some(function retainsInPlaceInput(source) { return source.content
     .includes('Original in-place context input'); }));
   if(throwingContext)assert.ok(receipts.some(function retainsInputBeforeFailure(source){return source.content
     .includes('Original input mutation before context failure');}));
   else{
    assert.ok(
      lateContextMutations>0,
      'The later queued native result mutation must actually run'
    );
    assert.ok(receipts.some(function retainsUnusedResult(source) { return source.content
      .includes('Original unselected context result'); }));
   }
   assert.ok(receipts.some(function retainsUnusedSystemResult(source) { return source.content
     .includes('Original unselected system context result'); }));
   assert.ok(receipts.every(function leavesContextAuthorityUnestablished(source) { return (source.permission===false)&&(source.registration===undefined); }));
   const snapshot=review.inputs
     .instructionSources[0]
     .sources;
   const input={
     snapshot,
     instructionSources:review.inputs
       .instructionSources,
     sourceCoverage:review.inputs
       .ruleSourceCoverage
   };
   for(const receipt of [
     undefined,
     {
       ...snapshot.nativeRunComposition
         .contextHandlerReceipt,
       runOccurrence:Object.freeze({})
     }
   ]){
    const {gaps} = inspectNativeSourceDomain({
      ...input,
      snapshot:{
        ...snapshot,
        nativeRunComposition:{
          ...snapshot.nativeRunComposition,
          contextHandlerReceipt:receipt
        }
      }
    });
    assert.ok(
      gaps.some(function missingOriginalCompletion(gap){return gap.reason
        .includes('"context"');}),
      'Missing or substituted original context completion must keep the source domain unresolved'
    );
   }
  }
//endregion
