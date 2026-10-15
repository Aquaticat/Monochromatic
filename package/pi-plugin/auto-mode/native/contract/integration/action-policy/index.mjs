import {resolveManualReviewOutcome} from './review-outcome.ts';
import {InstructionResolutionInputError} from '../../lifecycle/instruction-policy-consumer-v3/resolve.mjs';

/**
 Resolve code-owned policy inside the existing judgment and close its evidence.
 readProgram belongs to trusted bootstrap code, never the model response.
 The native approval router selects manual confirmation for uncertain outcomes.
 */
export function decideAndClose({
  judgment,
  readProgram
}){
 judgment.assertDependenciesCurrent();
 judgment.checkpoint();
 const program=readProgram();
 const outcome=resolveManualReviewOutcome(program);
 judgment.assertDependenciesCurrent();
 judgment.checkpoint();
 const closure=judgment.finalize();
 return Object.freeze({
   outcome,
   program,
   closure
 });
}

/** Issue only the relation kinds required by the original code-owned policy. */
function issuePolicyBatch({
  judgment,
  relationDefinitionId,
  requestMaterialDefinitionId,
  headingContextDefinitionId,
  unitAdoptionDefinitionId
}){
  judgment.assertDependenciesCurrent();
  judgment.checkpoint();
  const batch=(requestMaterialDefinitionId!==undefined)||(headingContextDefinitionId!==undefined)
    ||(unitAdoptionDefinitionId!==undefined)?judgment.issueBoundPolicyBatch({
    clauseRelations:relationDefinitionId!==undefined,
    requestMaterial:requestMaterialDefinitionId!==undefined,
    headingContexts:headingContextDefinitionId!==undefined,
    unitAdoptions:unitAdoptionDefinitionId!==undefined
  }):relationDefinitionId===undefined?judgment.issueRuleAssessmentBatch():judgment.issueProgramRuleBatch({definitionId:relationDefinitionId});
  return batch;
}

/**
 Optionally collect rule meaning and whole-operation relations in one original batch.
 The caller chooses whether relations are needed; proven code facts avoid a request.
 readProgram receives original captured evidence, never a model-authored verdict.
 */
export async function assessAndDecide({
  judgment,
  needsRelations,
  readProgram,
  relationDefinitionId,
  requestMaterialDefinitionId,
  headingContextDefinitionId,
  unitAdoptionDefinitionId
}){
 if((typeof needsRelations)!=='boolean')throw new InstructionResolutionInputError('Whether semantic estimates are needed must be a code-supplied boolean');
 if((relationDefinitionId!==undefined)&&(relationDefinitionId!=='clause_operation_relation'))throw new InstructionResolutionInputError('Configured relation definition is outside the implemented policy consumer');
 if((requestMaterialDefinitionId!==undefined)&&(requestMaterialDefinitionId!=='request_instruction_content'))throw new InstructionResolutionInputError('Configured request-material definition is outside the implemented content consumer');
 if((headingContextDefinitionId!==undefined)&&(headingContextDefinitionId!=='heading_instruction_content'))throw new InstructionResolutionInputError('Configured heading definition is outside the implemented content consumer');
 if((unitAdoptionDefinitionId!==undefined)&&(unitAdoptionDefinitionId!=='unit_adoption'))throw new InstructionResolutionInputError('Configured unit-adoption definition is outside the implemented incorporation consumer');
 const assessment={evidence:undefined};
 if(needsRelations){
   const batch=issuePolicyBatch({
     judgment,relationDefinitionId,requestMaterialDefinitionId,headingContextDefinitionId,unitAdoptionDefinitionId
   });
   await judgment.assess(batch);
   const evidence=judgment.captureBatchEvidence(batch);
   judgment.assertBatchEvidence(evidence);
   assessment.evidence=evidence;
 }
 return decideAndClose({
  judgment,
  readProgram:function readOriginalProgram() { return (readProgram({evidence:assessment.evidence})); }
 });
}
