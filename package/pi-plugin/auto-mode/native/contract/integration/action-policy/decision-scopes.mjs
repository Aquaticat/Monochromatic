import {semanticAdmissionScope} from './semantic-policy.ts';

//region Admission questions follow the selected policy and original input candidates.
/** Same-source incorporation needs the original single-member clause interpretation. */
function captureUnitScope({
  inputs,
  unitPolicy,
  scope
}){
 const inspected=semanticAdmissionScope({
   policy:unitPolicy,
   inputs
 });
 if(inspected.state!=='matching')return inspected;
 if((scope.state!=='matching')||(inputs.effects
   .length
   !==1))
  return Object.freeze({
    state:'out-of-profile',
    reason:'Unit incorporation requires one original member and clause interpretation.'
  });
 if(inputs.unitAdoptionPairs
   .length
   ===0)
  return Object.freeze({
    state:'no-unit-pairs',
    reason:'No bounded original same-source pair needs assessment.'
  });
 return inspected;
}
/** Current selected sources and the retained native program determine which questions are meaningful. */
export function captureScopes({
  inputs,
  policy,
  headingPolicy,
  unitPolicy
}){
 const scope=semanticAdmissionScope({
   policy,
   inputs
 });
 const inspectedHeading=semanticAdmissionScope({
   policy:headingPolicy,
   inputs,
   requireCandidates:false
 });
 const headingScope=(inspectedHeading.state==='matching')&&(inputs.headingContextCandidates
   .length
   ===0)
  ?Object.freeze({
    state:'no-heading-context',
    reason:'No original contextual-heading groups need assessment.'
  })
  :inspectedHeading;
 const unitScope=captureUnitScope({
   inputs,
   unitPolicy,
   scope
 });
 return {
   scope,
   headingScope,
   unitScope
 };
}
//endregion Admission question selection
