import {maximumQuestions} from '../maintained-policy.mjs';

//region Provider capacity affects automatic assessment, never original source capture.
/** Preserve every source and route an unavailable complete assessment through the existing uncertainty policy. */
export function selectAssessmentCapacity({inputs,scope,headingScope,unitScope}){
 const questionCount=(scope.state==='matching'?inputs.instructionCandidates.length:0)
   +(headingScope.state==='matching'?inputs.headingContextCandidates.length:0)
   +(unitScope.state==='matching'?inputs.unitAdoptionPairs.length:0);
 if(questionCount<=maximumQuestions)return {scope,headingScope,unitScope};
 const reason=`The complete operation needs ${questionCount} instruction assessments, but the selected provider accepts ${maximumQuestions} questions per request. No instruction was dropped and no automatic assessment was admitted.`;
 const unavailable=Object.freeze({state:'out-of-profile',reason});
 return {scope:unavailable,headingScope:unavailable,unitScope:unavailable,reason};
}
//endregion
