import assert from 'node:assert/strict';
import {inspectNativeSourceDomain} from '../policy-source/source-domain.mjs';

//region Missing original receipt or membership evidence must keep the domain unresolved.
export function assertCompleteDomainResolution(review){
   // Audit retained immutable evidence; the completed request is no longer eligible for live use.
   const input={
     snapshot:review.inputs
       .instructionSources[0]
       .sources,
     instructionSources:review.inputs
       .instructionSources,
     sourceCoverage:review.inputs
       .ruleSourceCoverage
   };
   assert.equal(
     inspectNativeSourceDomain(input)
       .gaps
       .length,
     0
   );
   const altered=[
    {
      ...input,
      snapshot:{
        ...input.snapshot,
        governingSources:input.snapshot
          .governingSources
          .slice(1)
      }
    },
    {
      ...input,
      instructionSources:input.instructionSources
        .slice(1)
    },
    {
      ...input,
      sourceCoverage:input.sourceCoverage
        .slice(1)
    },
    {
      ...input,
      snapshot:{
        ...input.snapshot,
        resourceReceiptInputs:[]
      }
    },
    {
      ...input,
      snapshot:{
        ...input.snapshot,
        nativeDomainEventKinds:undefined
      }
    },
    {
      ...input,
      snapshot:{
        ...input.snapshot,
        nativeDomainEventKinds:['turn_start']
      }
    }
   ];
   for(const incomplete of altered)assert.ok(
     inspectNativeSourceDomain(incomplete)
       .gaps
       .length
       >0,
     'Removing original receipt or membership evidence must keep the domain unresolved'
   );
  }
//endregion
