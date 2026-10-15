import {PolicySlotBindingError} from './system-slot-error.mjs';
import {createPolicyLoaderState} from './policy-loader.mjs';
export {PolicySlotBindingError} from './system-slot-error.mjs';

// Module-private construction key and instance fields authenticate the owning
// callback, without a second global source/session registry.
const constructionKey=Object.freeze({});
class SystemPolicyInput {
 #state;
 constructor({
   key,
   state
 }){
  if(key!==constructionKey)throw new PolicySlotBindingError('Requires original policy-input capability');
  this.#state=state;Object.freeze(this);
 }
 static #stateFor(input){
  if((!input)||(typeof input)!=='object'
    ||(!(#state in input)))throw new PolicySlotBindingError('Requires original policy-input capability');
  return input.#state;
 }
 static read(input){return SystemPolicyInput.#stateFor(input)
   .readCurrent();}
 static assert({
   input,
   binding
 }){SystemPolicyInput.#stateFor(input)
   .assertCurrent(binding);}
 static collector({
   input,
   context
 }){return SystemPolicyInput.#stateFor(input)
   .bindCollector(context);}
 static sessionCollector({
   input,
   session
 }){return SystemPolicyInput.#stateFor(input)
   .bindSessionCollector(session);}
 static hostPrompt(input){
  const state=SystemPolicyInput.#stateFor(input);
  state.readCurrent();return state.hostPrompt;
 }
 static registration(input){
  const state=SystemPolicyInput.#stateFor(input);
  state.readCurrent();return state.registration;
 }
 get loader(){return this.#state
   .loader;}
 get nativeBinding(){return this.#state
   .nativeBinding;}
 async reload(options){return await this.#state
   .reload(options);}
 readCurrent(){return this.#state
   .readCurrent();}
 assertCurrent(binding){this.#state
   .assertCurrent(binding);}
}
Object.freeze(SystemPolicyInput.prototype);
Object.freeze(SystemPolicyInput);

/** Read through the real callback owner, never a caller-created reader. */
export function readPolicyInput(input){return SystemPolicyInput.read(input);}
/** Require the actual system-input carrier when proving system-message placement. */
export function readSystemPolicyInput(input){
 const value=readPolicyInput(input);
 if(value.slot!=='customPrompt')throw new PolicySlotBindingError('Original policy input is not a system-prompt carrier');
 return value;
}
/** Revalidate through private instance state; copied methods cannot mint a link. */
export function assertPolicyInput(input){SystemPolicyInput.assert(input);}
export function assertSystemPolicyInput(input){assertPolicyInput(input);}
/** Read an immutable declaration through its original owner, never action metadata. */
export function readAuthorityRegistration(input){return SystemPolicyInput.registration(input);}
/** Original explicitly configured host text, not the composite system message. */
export function readHostPromptInput(input){return SystemPolicyInput.hostPrompt(input);}
/** Extend the incumbent collector with this owner's exact governing-source capture. */
export function bindPolicyCollector(input){return SystemPolicyInput.collector(input);}
/** Retain actual native session/base/run publication links through the incumbent owner. */
export function bindPolicySessionCollector(input){return SystemPolicyInput.sessionCollector(input);}

/** Select governing policy without replacing any native prompt or context input. */
export function createGoverningPolicyLoader(input){
 return new SystemPolicyInput({
  key:constructionKey,
  state:createPolicyLoaderState({...input,systemSlot:false})
 });
}
/** Feed the same policy capture through a fixed system callback for the narrow placement profile. */
export function createSystemPolicyLoader(input){
 return new SystemPolicyInput({
  key:constructionKey,
  state:createPolicyLoaderState({...input,systemSlot:true})
 });
}
