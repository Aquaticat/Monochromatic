import {createHash} from 'node:crypto';

export class QuestionSelectionError extends Error {constructor(
  message,
  options
){super(
  message,
  options
);this.name=this.constructor
  .name;}}
function object(value){return (value!==null)&&((typeof value)==='object');}
function text(value){return ((typeof value)==='string')&&(value.length>0)
  &&value.isWellFormed();}

/** Retain optional validated serving-model attribution without adding another serialized answer envelope. */
export function readAssessmentResponse(input){
  if((typeof input)==='string')return Object.freeze({answerText:input});
  if((!input)||((typeof input)!=='object')
    ||(Object.getPrototypeOf(input)!==Object.prototype)
    ||(Reflect.ownKeys(input)
      .length
      !==2)
    ||(!Object.hasOwn(
      input,
      'answerText'
    ))
    ||(!Object.hasOwn(
      input,
      'model'
    )))throw new QuestionSelectionError('Assessment response requires answer text and its serving-model attribution');
  const answer=Object.getOwnPropertyDescriptor(
    input,
    'answerText'
  ); const model=Object.getOwnPropertyDescriptor(
    input,
    'model'
  );
  if((!answer?.enumerable)||(!Object.hasOwn(
    answer,
    'value'
  ))
    ||((typeof answer.value)!=='string')
    ||(!model?.enumerable)
    ||(!Object.hasOwn(
      model,
      'value'
    ))
    ||(!text(model.value))
    ||(Buffer.byteLength(model.value)>256))throw new QuestionSelectionError('Attributed assessment response requires bounded model text and data properties');
  return Object.freeze({
    answerText:answer.value,
    model:model.value
  });
}

/** Validate already-parsed JSON against fixed criteria; this establishes no claim identity or semantic qualification. */
export function readRelationEstimate({
  definition,
  value
}){
  if(definition.type==='noul'){
    if(Number.isFinite(value)&&(value>=0)
      &&(value<=1))return value;
    throw new QuestionSelectionError('Scalar answer must be a bounded numeric estimate');
  }
  if(definition.type!=='choice')throw new QuestionSelectionError('Estimate definition type is unsupported');
  if((!object(value))||Array.isArray(value)
    ||(Object.keys(value)
      .toSorted()
      .join(',')
      !=='choice,probabilities')
    ||(!text(value.choice))
    ||(!Object.hasOwn(
      definition.criteria,
      value.choice
    )))throw new QuestionSelectionError('Choice answer must select an option from its original definition');
  const {probabilities} = value;
    const labels=Object.keys(definition.criteria);
  if((!object(probabilities))
    ||Array.isArray(probabilities)
    ||(Object.keys(probabilities)
      .length
      !==labels.length)
    ||Object.keys(probabilities)
    .some(label=>!Object.hasOwn(
    definition.criteria,
    label
  )))throw new QuestionSelectionError('Choice probabilities differ from the original option set');
  let largest=0;
    let total=0;
  for(const label of labels){
    const probability=probabilities[label];
    if((!Number.isFinite(probability))||(probability<0)
      ||(probability>1))throw new QuestionSelectionError('Choice probabilities must be bounded numbers');
    total+=probability;largest=Math.max(
      largest,
      probability
    );
  }
  // Allow floating-point reporting drift, not a semantic confidence cutoff; never normalize the received values.
  if((Math.abs(total-1)>0.000001)||(probabilities[value.choice]!==largest))throw new QuestionSelectionError('Choice answer is not a complete distribution with a highest-probability selected option');
  Object.freeze(probabilities);
  return Object.freeze(value);
}

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
  if((!text(catalogText))||(Buffer.byteLength(catalogText)>1_048_576)
    ||((typeof resolveBinding)!=='function'))throw new QuestionSelectionError('Question catalog or owned binding resolver is unavailable');
  const digest=createHash('sha256')
    .update(catalogText)
    .digest('hex');
  if(digest!==catalogSHA256)throw new QuestionSelectionError('Question catalog bytes differ from the pinned definitions');
  if((!object(envelope))||(!Object.isFrozen(envelope)))throw new QuestionSelectionError('Question envelope must be an immutable owned projection');
  let parsed;
  try{parsed=JSON.parse(catalogText);}catch(error){throw new QuestionSelectionError(
    'Question catalog is not valid JSON',
    {cause:error}
  );}
  if((!object(parsed))||Array.isArray(parsed))throw new QuestionSelectionError('Question catalog must be a definition object');
  const entries=Object.entries(parsed);
  if((entries.length===0)||(entries.length>512))throw new QuestionSelectionError('Question definition count exceeds the declared profile');
  const definitions=new Map();
    const byDefinition=new Map();
    const claims=new WeakMap();
    const batches=new WeakMap();
    const batchByEvidence=new WeakMap();
  for(const [id,value] of entries){
    if((!text(id))||(!object(value))
      ||Array.isArray(value)
      ||(![
        'noul',
        'choice'
      ].includes(value.type))
      ||(!text(value.instructions))
      ||(!object(value.criteria))
      ||Array.isArray(value.criteria))throw new QuestionSelectionError('Question definition is missing its fixed predicate or criteria');
    if(Object.keys(value)
      .toSorted()
      .join(',')
      !=='criteria,instructions,type')throw new QuestionSelectionError('Question definition has undeclared fields');
    const criteria=Object.entries(value.criteria);
    if(criteria.some(([label,rubric])=>(!text(label))||(!text(rubric))))throw new QuestionSelectionError('Question options require named text rubrics');
    if((value.type==='noul')&&(Object.keys(value.criteria)
      .toSorted()
      .join(',')
      !=='false,true'))throw new QuestionSelectionError('Scalar definition requires exactly true and false criteria');
    if((value.type==='choice')&&((criteria.length<2)||(criteria.length>255)))throw new QuestionSelectionError('Choice definition requires two through 255 options');
    const fixedCriteria=Object.freeze(value.type==='noul'?{
      true:value.criteria
        .true,
      false:value.criteria
        .false
    }:value.criteria);
    definitions.set(
      id,
      Object.freeze({
        type:value.type,
        instructions:value.instructions,
        criteria:fixedCriteria
      })
    );byDefinition.set(
      id,
      new WeakMap()
    );
  }
  let batchCount=0;
    let declaredCount=0;
    let locked=false;
  function retainedOperation(operation){if(locked)throw new QuestionSelectionError('Question binding operations cannot reenter');locked=true;try{return operation();}finally{locked=false;}}
  function atomic(operation){return retainedOperation(()=>{budget.checkpoint();return operation();});}
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
  }){return atomic(()=>{
    const definition=definitions.get(definitionId);if(!definition)throw new QuestionSelectionError('Selected question definition is not in the pinned catalog');
    const binding=resolve(bindingHandle);
      const canonical=byDefinition.get(definitionId);
      const existing=canonical.get(binding.identity);
    if(existing){const claim=knownClaim(existing);if(claim.binding!==binding)throw new QuestionSelectionError('Binding identity was reused for a different record');budget.checkpoint();return existing;}
    if(declaredCount>=1_536)throw new QuestionSelectionError('Judgment exceeds the declared total claim bound');
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
    );declaredCount+=1;return handle;
  });}
  function issue(input){return atomic(()=>{
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
    if(batchCount>=3)throw new QuestionSelectionError('Judgment exceeds the declared question batch bound');
    const selected=handles.map(knownClaim);
    for(const claim of selected){if(claim.issued)throw new QuestionSelectionError('Claim was already issued; uncertainty cannot create another selection');current(claim);}
    budget.checkpoint();
    const request=Object.freeze({
      envelope,
      catalogSHA256:digest,
      questions:Object.freeze(selected.map((
        claim,
        index
      )=>Object.freeze({
        id:`q${index}`,
        definitionId:claim.definitionId,
        definition:claim.definition,
        binding:claim.binding
          .projection
      }))),
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
    );batchCount+=1;return handle;
  });}
  function requestFor(handle){return atomic(()=>{const batch=knownBatch(handle);if(batch.settled)throw new QuestionSelectionError('Question batch is terminal; it cannot be dispatched again');for(const claim of batch.selected)current(claim);budget.checkpoint();return batch.request;});}
  function settle({
    batch:handle,
    answerText,
    model
  }){return retainedOperation(()=>{
    const batch=knownBatch(handle);if(batch.settled)throw new QuestionSelectionError('Question batch already has a terminal response');
    const retainedRaw=((typeof answerText)==='string')&&(Buffer.byteLength(answerText)<=65_536)?answerText:undefined;
    try {
    budget.checkpoint();for(const claim of batch.selected)current(claim);
    let failure;
    let values;
    try{
      if((model!==undefined)&&((!text(model))||(Buffer.byteLength(model)>256)))throw new QuestionSelectionError('Assessment model attribution is malformed');
      if((retainedRaw===undefined)||(!answerText.isWellFormed()))throw new QuestionSelectionError('Answer text exceeds the declared JSON response profile');
      const answers=JSON.parse(answerText);if((!Array.isArray(answers))||(answers.length
        !==batch.selected
        .length))throw new QuestionSelectionError('Answer membership differs from the issued question batch');
      values=answers.map((
        answer,
        index
      )=>{
        if((!object(answer))||Array.isArray(answer)
          ||(answer.id!==(`q${
            index}`)))throw new QuestionSelectionError('Answer identity differs from the issued question');
        if((answer.status==='estimate')&&(Object.keys(answer)
          .toSorted()
          .join(',')
          ==='id,status,value'))return Object.freeze({
          status:'estimate',
          value:readRelationEstimate({
            definition:batch.selected[index]
              .definition,
            value:answer.value
          })
        });
        if((answer.status==='unresolved')&&(Object.keys(answer)
          .toSorted()
          .join(',')
          ==='id,reason,status')
          &&text(answer.reason))return Object.freeze({
          status:'unresolved',
          reason:answer.reason
        });
        throw new QuestionSelectionError('Answer is neither a bounded estimate nor an explicit unresolved result');
      });
    }catch(error){failure=error;values=batch.selected
      .map(()=>Object.freeze({status:'malformed'}));}
    budget.checkpoint();
    for(const [index,claim] of batch.selected
      .entries()){claim.answer=values[index];if((failure===undefined)&&(model!==undefined))claim.model=model;}
    batch.settled=true;batch.record=Object.freeze({
      answers:Object.freeze(values),
      raw:retainedRaw,
      malformed:failure!==undefined,
      discarded:false,
      failure,
      ...((failure===undefined)&&(model!==undefined)?{model}:{}),
      semanticQualification:'not-established',
      instructionAuthority:'not-established'
    });return batch.record;
    } catch(error) {
      const values=batch.selected
        .map(()=>Object.freeze({status:'discarded'}));
      for(const [index,claim] of batch.selected
        .entries())claim.answer=values[index];
      batch.settled=true;batch.record=Object.freeze({
        answers:Object.freeze(values),
        raw:retainedRaw,
        malformed:false,
        discarded:true,
        failure:error,
        semanticQualification:'not-established',
        instructionAuthority:'not-established'
      });
      throw error;
    }
  });}
  function answerFor(handle){return atomic(()=>{const claim=knownClaim(handle);current(claim);budget.checkpoint();return Object.freeze({
    issued:claim.issued,
    answer:claim.answer,
    semanticQualification:'not-established'
  });});}
  function resultFor(handle){return atomic(()=>{const batch=knownBatch(handle);if(!batch.settled)throw new QuestionSelectionError('Question batch has no terminal response');for(const claim of batch.selected)current(claim);budget.checkpoint();return batch.record;});}
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
  function assertCapturableBatch(handle){return retainedOperation(()=>{
    const batch=knownBatch(handle);
    if((!batch.settled)
      ||batch.selected
      .some(claim=>(!claim.issued)||(![
        'estimate',
        'unresolved'
      ].includes(claim.answer
        ?.status))))throw new QuestionSelectionError('Original batch has no complete usable relation evidence');
  });}
  /** Capture every claim from the exact internally issued batch, with no borrowed claim arrays. */
  function captureBatchEvidence(handle){return atomic(()=>{
    const batch=knownBatch(handle);
    if((!batch.settled)
      ||batch.selected
      .some(claim=>(!claim.issued)||(![
        'estimate',
        'unresolved'
      ].includes(claim.answer
        ?.status))))throw new QuestionSelectionError('Original batch has no complete usable relation evidence');
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
  function assertCapturedBatchIdentity(evidence){return retainedOperation(()=>{
    const batch=object(evidence)?batchByEvidence.get(evidence):undefined;
    if((!batch)||(batch.evidence!==evidence))throw new QuestionSelectionError('Relation evidence is not an original captured batch from this judgment');
  });}
  /** Capture the original settled relation before evidence closure; no truth or permission is inferred. */
  function captureEvidence(handle){return atomic(()=>{
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
  }){return retainedOperation(()=>{
    const claim=knownClaim(handle);
    if((!claim.evidence)||(claim.evidence!==evidence))throw new QuestionSelectionError('Relation evidence is not the canonical record for this original claim');
  });}
  /** Retain a failed transport/finalization occurrence without reviving or reissuing its claims. */
  function discard({
    batch:handle,
    error
  }){return retainedOperation(()=>{const batch=knownBatch(handle);if(batch.settled)throw new QuestionSelectionError('Question batch already has a terminal response');const values=batch.selected
    .map(()=>Object.freeze({status:'discarded'}));for(const [index,claim] of batch.selected
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
  function inspectClaim(handle){return retainedOperation(()=>{const claim=knownClaim(handle);return Object.freeze({
    retainedOnly:true,
    issued:claim.issued,
    answer:claim.answer
  });});}
  /** Retained late/stale records never become usable evidence through this inspection path. */
  function inspectBatch(handle){return retainedOperation(()=>{const batch=knownBatch(handle);return Object.freeze({
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
