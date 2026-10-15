import assert from 'node:assert/strict';
import {createJudgmentInstructions} from './judgment-instructions.mjs';
import {JudgmentConstructionError} from './judgment-input.mjs';

//region Whole-request claims retain the original request and reuse their owned selector.
const request=Object.freeze({body:'{"messages":[{"role":"user","content":"Review this request"}]}'});
const state={failure:undefined};
const declared=[];

/** Keep the dependency boundary observable without substituting the instruction implementation. */
function ready(){
  if(state.failure)throw state.failure;
}

/** Capture the original selection input that the evidence owner would consume. */
function declare(input){
  declared.push(input);
  return input.bindingHandle;
}

/** Preserve one selection owner across repeated request claims. */
function knownSelection(){return Object.freeze({declare});}

const instructions=createJudgmentInstructions({
  ready,
  knownSelection,
  receipt:Object.freeze({request}),
  bindings:new WeakMap()
});
const first=instructions.claimRequestMaterial();
const repeated=instructions.claimRequestMaterial();
assert.equal(first,repeated);
assert.equal(declared.length,2);
assert.equal(declared[0].definitionId,'request_instruction_content');
assert.equal(declared[1].bindingHandle,first);
assert.equal(instructions.requestMaterialFor(),request);
const binding=instructions.resolveBinding(first);
assert.equal(binding.identity,request);
assert.equal(binding.projection.claimScope,'program-request');
assert.equal(binding.projection.requestMaterial,request);
assert.throws(function rejectForeignHandle(){instructions.resolveBinding(Object.freeze({}));},JudgmentConstructionError);
state.failure=new JudgmentConstructionError('Original request dependency retired');
assert.throws(function rejectRetiredClaim(){instructions.claimRequestMaterial();},state.failure);
assert.throws(function rejectRetiredBinding(){instructions.resolveBinding(first);},state.failure);
console.log(JSON.stringify({complete:true,originalRequest:true,repeatedSelector:true,foreignHandleRejected:true,retirementRejected:true}));
//endregion
