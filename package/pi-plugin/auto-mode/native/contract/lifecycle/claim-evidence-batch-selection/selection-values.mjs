import {QuestionSelectionError} from './selection-error.mjs';

//region Validate response and relation data without issuing claim identity.
export function object(value){return (value!==null)&&((typeof value)==='object');}
export function text(value){return ((typeof value)==='string')&&(value.length>0)
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
    .some(function lacksDeclaredCriterion(label) { return (!Object.hasOwn(
    definition.criteria,
    label
  )); }))throw new QuestionSelectionError('Choice probabilities differ from the original option set');
  const distribution={largest:0,total:0};
  for(const label of labels){
    const probability=probabilities[label];
    if((!Number.isFinite(probability))||(probability<0)
      ||(probability>1))throw new QuestionSelectionError('Choice probabilities must be bounded numbers');
    distribution.total+=probability;distribution.largest=Math.max(
      distribution.largest,
      probability
    );
  }
  // Allow floating-point reporting drift, not a semantic confidence cutoff; never normalize the received values.
  if((Math.abs(distribution.total-1)>0.000001)||(probabilities[value.choice]!==distribution.largest))throw new QuestionSelectionError('Choice answer is not a complete distribution with a highest-probability selected option');
  Object.freeze(probabilities);
  return Object.freeze(value);
}

//endregion
