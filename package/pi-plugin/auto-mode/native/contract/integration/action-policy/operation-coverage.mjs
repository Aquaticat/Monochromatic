import {matchesSemanticProgramProfile} from '../maintained-policy.mjs';

//region Original scheduler and inspected program shape gate estimated operation coverage.
export function inspectOperationCoverage({inputs,clauseEnabled,policy}){
 // Multiple root programs need the original dispatcher schedule, not order inferred from their array positions.
 // Legacy single-member inputs have no outer inter-member scheduling obligation.
 const groupExecutionMode=inputs.effects[0]
   ?.prepared
   .groupExecutionMode;
 const scheduled=[
   'parallel',
   'sequential'
 ].includes(groupExecutionMode)
   &&inputs.effects
   .every(function matchesGroupExecutionMode(effect) { return (effect.prepared
     .groupExecutionMode
     ===groupExecutionMode); });
 const singleLegacy=(inputs.effects
   .length
   ===1)&&(groupExecutionMode===undefined);
 // Independent implementation-fact contracts keep their gaps until their concrete uses are modeled.
 const operation=clauseEnabled
   &&(inputs.effects
     .length
     >0)
   &&(scheduled||singleLegacy)
   &&inputs.effects
   .every(function matchesUnownedProgramProfile(effect) { return ((effect.owner===undefined)&&matchesSemanticProgramProfile({
     configured:policy.programProfile,
     inspected:effect.programInspection
       ?.declaration
       .profile
   })); })
  ?Object.freeze({
    preparedOperations:inputs.effects,
    groupExecutionMode
  }):undefined;
 return operation;
}
//endregion
