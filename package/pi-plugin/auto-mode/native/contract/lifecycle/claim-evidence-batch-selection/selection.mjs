import {QuestionSelectionError} from './selection-error.ts';
import {object} from './selection-values.ts';
import {readQuestionDefinitions} from './selection-definitions.ts';
import {createQuestionSettlement} from './selection-settlement.mjs';

export {QuestionSelectionError} from './selection-error.ts';
export {readAssessmentResponse,readRelationEstimate} from './selection-values.ts';

//region Fixed definition data and judgment-local claim issuance, never semantic qualification or permission.
/** Enclosing owner supplies one existing budget and a trusted synchronous, side-effect-free binding resolver. */
export function createQuestionSelection({
  catalogText,
  catalogSHA256,
  budget,
  resolveBinding,
  envelope=Object.freeze({})
}) {
  budget.checkpoint();
  const {digest,definitions,byDefinition}=readQuestionDefinitions({catalogText,catalogSHA256,resolveBinding,envelope});
  const claims=new WeakMap();
  const batches=new WeakMap();
  const batchByEvidence=new WeakMap();
  const selectionState={batchCount:0,declaredCount:0,locked:false};
  function retainedOperation(operation){if(selectionState.locked)throw new QuestionSelectionError('Question binding operations cannot reenter');selectionState.locked=true;
   using selectionScope={
    [Symbol.dispose](){selectionState.locked=false;}
   };
   return operation();}
  function atomic(operation){return retainedOperation(function runWithinQuestionBudget() {budget.checkpoint();return operation();});}
  function resolve(handle){
    const binding=resolveBinding(handle);
    if((!object(binding))||(!Object.isFrozen(binding))
      ||(!object(binding.identity))
      ||(!Object.isFrozen(binding.identity))
      ||(!Object.hasOwn(
        binding,
        'projection'
      )))throw new QuestionSelectionError('Binding resolver did not return an immutable owned occurrence');
    // Deeply immutable projection and occurrence eligibility are the resolver's declared obligations.
    return binding;
  }
  function knownClaim(handle){const claim=object(handle)?claims.get(handle):undefined;if(!claim)throw new QuestionSelectionError('Claim handle is not owned by this judgment');return claim;}
  function current(claim){if(resolve(claim.bindingHandle)!==claim.binding)throw new QuestionSelectionError('Claim binding changed; the original judgment must not silently rebind');}
  function knownBatch(handle){const batch=object(handle)?batches.get(handle):undefined;if(!batch)throw new QuestionSelectionError('Question batch is not owned by this judgment');return batch;}
  function declare({
    definitionId,
    bindingHandle
  }){return atomic(function selectOriginalClaim() {
    const definition=definitions.get(definitionId);if(!definition)throw new QuestionSelectionError('Selected question definition is not in the pinned catalog');
    const binding=resolve(bindingHandle);
      const canonical=byDefinition.get(definitionId);
      const existing=canonical.get(binding.identity);
    if(existing){const claim=knownClaim(existing);if(claim.binding!==binding)throw new QuestionSelectionError('Binding identity was reused for a different record');budget.checkpoint();return existing;}
    if(selectionState.declaredCount>=1_536)throw new QuestionSelectionError('Judgment exceeds the declared total claim bound');
    budget.checkpoint();const handle=Object.freeze({});claims.set(
      handle,
      {
        definitionId,
        definition,
        bindingHandle,
        binding,
        issued:false,
        answer:undefined
      }
    );canonical.set(
      binding.identity,
      handle
    );selectionState.declaredCount+=1;return handle;
  });}
  function issue(input){return atomic(function constructOriginalQuestionBatch() {
    if((!Array.isArray(input))||(Object.getPrototypeOf(input)!==Array.prototype)
      ||(input.length===0)
      ||(input.length>512)
      ||(Reflect.ownKeys(input)
        .length
        !==(input.length
        +1)))throw new QuestionSelectionError('Question batch needs an ordinary dense claim array within the declared bound');
    const handles=[];
    for(let index=0;index<input.length;index+=1){const property=Object.getOwnPropertyDescriptor(
      input,
      String(index)
    );if((!property)||(!Object.hasOwn(
      property,
      'value'
    ))
      ||(!property.enumerable))throw new QuestionSelectionError('Question batch has an accessor, hidden member or missing member');handles.push(property.value);}
    if(new Set(handles).size!==handles.length)throw new QuestionSelectionError('Question batch repeats a claim');
    if(selectionState.batchCount>=3)throw new QuestionSelectionError('Judgment exceeds the declared question batch bound');
    const selected=handles.map(knownClaim);
    for(const claim of selected){if(claim.issued)throw new QuestionSelectionError('Claim was already issued; uncertainty cannot create another selection');current(claim);}
    budget.checkpoint();
    const request=Object.freeze({
      envelope,
      catalogSHA256:digest,
      questions:Object.freeze(selected.map(function describeSelectedClaim(
        claim,
        index
      ) { return (Object.freeze({
        id:`q${index}`,
        definitionId:claim.definitionId,
        definition:claim.definition,
        binding:claim.binding
          .projection
      })); })),
      semanticQualification:'not-established',
      instructionAuthority:'not-established'
    });
    if(Buffer.byteLength(JSON.stringify(request))>4_194_304)throw new QuestionSelectionError('Question request exceeds the four MiB wire profile');
    budget.checkpoint();
    const handle=Object.freeze({});for(const claim of selected)claim.issued=true;batches.set(
      handle,
      {
        selected,
        request,
        settled:false,
        record:undefined
      }
    );selectionState.batchCount+=1;return handle;
  });}
  function requestFor(handle){return atomic(function retainOriginalBatchRequest() {const batch=knownBatch(handle);if(batch.settled)throw new QuestionSelectionError('Question batch is terminal; it cannot be dispatched again');for(const claim of batch.selected)current(claim);budget.checkpoint();return batch.request;});}
  const settle=createQuestionSettlement({knownBatch,retainedOperation,budget,current});
  function answerFor(handle){return atomic(function inspectCurrentClaim() {const claim=knownClaim(handle);current(claim);budget.checkpoint();return Object.freeze({
    issued:claim.issued,
    answer:claim.answer,
    semanticQualification:'not-established'
  });});}
  function resultFor(handle){return atomic(function readCurrentBatchRecord() {const batch=knownBatch(handle);if(!batch.settled)throw new QuestionSelectionError('Question batch has no terminal response');for(const claim of batch.selected)current(claim);budget.checkpoint();return batch.record;});}
  /** Build only from validated owner-local immutable records; callers still own publication currentness. */
  function canonicalEvidence(claim){
    if(!claim.evidence)claim.evidence=Object.freeze({
      definitionId:claim.definitionId,
      definition:claim.definition,
      binding:claim.binding
        .projection,
      envelope,
      answer:claim.answer,
      ...(claim.model!==undefined?{model:claim.model}:{}),
      semanticQualification:'not-established',
      instructionAuthority:'not-established',
      permission:false
    });
    return claim.evidence;
  }
  /** Authenticate and check terminal phase only, never dependency eligibility. */
  function assertCapturableBatch(handle){return retainedOperation(function assertCompleteRelationBatch() {
    const batch=knownBatch(handle);
    if((!batch.settled)
      ||batch.selected
      .some(function lacksUsableClaimAnswer(claim) { return ((!claim.issued)||(![
        'estimate',
        'unresolved'
      ].includes(claim.answer
        ?.status))); }))throw new QuestionSelectionError('Original batch has no complete usable relation evidence');
  });}
  /** Capture every claim from the exact internally issued batch, with no borrowed claim arrays. */
  function captureBatchEvidence(handle){return atomic(function retainCompleteRelationEvidence() {
    const batch=knownBatch(handle);
    if((!batch.settled)
      ||batch.selected
      .some(function lacksRetainedClaimAnswer(claim) { return ((!claim.issued)||(![
        'estimate',
        'unresolved'
      ].includes(claim.answer
        ?.status))); }))throw new QuestionSelectionError('Original batch has no complete usable relation evidence');
    for(const claim of batch.selected)current(claim);
    budget.checkpoint();
    if(!batch.evidence){batch.evidence=Object.freeze(batch.selected
      .map(canonicalEvidence));batchByEvidence.set(
      batch.evidence,
      batch
    );}
    budget.checkpoint();return batch.evidence;
  });}
  /** Canonical batch identity only; original judgment must separately check dependencies. */
  function assertCapturedBatchIdentity(evidence){return retainedOperation(function assertOriginalBatchEvidence() {
    const batch=object(evidence)?batchByEvidence.get(evidence):undefined;
    if((!batch)||(batch.evidence!==evidence))throw new QuestionSelectionError('Relation evidence is not an original captured batch from this judgment');
  });}
  /** Capture the original settled relation before evidence closure; no truth or permission is inferred. */
  function captureEvidence(handle){return atomic(function retainOriginalClaimEvidence() {
    const claim=knownClaim(handle);current(claim);
    if((!claim.issued)||(![
      'estimate',
      'unresolved'
    ].includes(claim.answer
      ?.status)))throw new QuestionSelectionError('Claim has no usable terminal relation evidence');
    budget.checkpoint();
    return canonicalEvidence(claim);
  });}
  /** Identity check only. Enclosing judgment must also check its current original dependencies. */
  function assertCapturedIdentity({
    claim:handle,
    evidence
  }){return retainedOperation(function assertOriginalClaimEvidence() {
    const claim=knownClaim(handle);
    if((!claim.evidence)||(claim.evidence!==evidence))throw new QuestionSelectionError('Relation evidence is not the canonical record for this original claim');
  });}
  /** Retain a failed transport/finalization occurrence without reviving or reissuing its claims. */
  function discard({
    batch:handle,
    error
  }){return retainedOperation(function discardOriginalQuestionBatch() {const batch=knownBatch(handle);if(batch.settled)throw new QuestionSelectionError('Question batch already has a terminal response');const values=batch.selected
    .map(function createDiscardedClaimAnswer() { return (Object.freeze({status:'discarded'})); });for(const [index,claim] of batch.selected
      .entries())claim.answer=values[index];batch.settled=true;batch.record=Object.freeze({
    answers:Object.freeze(values),
    raw:undefined,
    malformed:false,
    discarded:true,
    failure:error,
    semanticQualification:'not-established',
    instructionAuthority:'not-established'
  });return batch.record;});}
  /** Diagnostic retention does not revalidate sources, the deadline, or permission. */
  function inspectClaim(handle){return retainedOperation(function inspectHistoricalClaim() {const claim=knownClaim(handle);return Object.freeze({
    retainedOnly:true,
    issued:claim.issued,
    answer:claim.answer
  });});}
  /** Retained late/stale records never become usable evidence through this inspection path. */
  function inspectBatch(handle){return retainedOperation(function inspectHistoricalBatch() {const batch=knownBatch(handle);return Object.freeze({
    retainedOnly:true,
    settled:batch.settled,
    record:batch.record
  });});}
  budget.checkpoint();return Object.freeze({
    declare,
    issue,
    requestFor,
    settle,
    answerFor,
    resultFor,
    inspectClaim,
    inspectBatch,
    discard,
    captureEvidence,
    assertCapturedIdentity,
    assertCapturableBatch,
    captureBatchEvidence,
    assertCapturedBatchIdentity
  });
}
//endregion
