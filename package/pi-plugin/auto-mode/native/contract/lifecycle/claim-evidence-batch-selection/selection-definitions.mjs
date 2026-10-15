import {createHash} from 'node:crypto';
import {QuestionSelectionError} from './selection-error.mjs';
import {object,text} from './selection-values.mjs';

function parseQuestionCatalog(catalogText){
  try{return JSON.parse(catalogText);}catch(error){throw new QuestionSelectionError(
    'Question catalog is not valid JSON',
    {cause:error}
  );}
}

//region Pin exact definition bytes before constructing the original claim catalog.
export function readQuestionDefinitions({catalogText,catalogSHA256,resolveBinding,envelope}){
  if((!text(catalogText))||(Buffer.byteLength(catalogText)>1_048_576)
    ||((typeof resolveBinding)!=='function'))throw new QuestionSelectionError('Question catalog or owned binding resolver is unavailable');
  const digest=createHash('sha256')
    .update(catalogText)
    .digest('hex');
  if(digest!==catalogSHA256)throw new QuestionSelectionError('Question catalog bytes differ from the pinned definitions');
  if((!object(envelope))||(!Object.isFrozen(envelope)))throw new QuestionSelectionError('Question envelope must be an immutable owned projection');
  const parsed=parseQuestionCatalog(catalogText);
  if((!object(parsed))||Array.isArray(parsed))throw new QuestionSelectionError('Question catalog must be a definition object');
  const entries=Object.entries(parsed);
  if((entries.length===0)||(entries.length>512))throw new QuestionSelectionError('Question definition count exceeds the declared profile');
  const definitions=new Map();
    const byDefinition=new Map();
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
    if(criteria.some(function hasInvalidCriterionText([label,rubric]) { return ((!text(label))||(!text(rubric))); }))throw new QuestionSelectionError('Question options require named text rubrics');
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
 return {digest,definitions,byDefinition};
}
//endregion
