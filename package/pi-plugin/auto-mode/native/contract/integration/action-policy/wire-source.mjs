import {createHash} from 'node:crypto';

export class RuleAssessmentWireError extends Error {
 constructor(message){super(message);this.name=this.constructor
   .name;}
}

export function sha(value){return createHash('sha256')
  .update(value)
  .digest('hex');}

//region Fixed ASCII rule tags have bounded length and no pattern-engine dependency.
export function isRuleCode(value){
 if(typeof value!=='string'||value.length!==3)return false;
 for(const character of value){
  if(!'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.includes(character))return false;
 }
 return true;
}
//endregion
