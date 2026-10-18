import {isProxy} from 'node:util/types';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {caughtValueText} from '@monochromatic-dev/module-caught-value/ts';

export class PolicyApprovalError extends Error {
 constructor(message){super(message);this.name=this.constructor
   .name;}
}

/**
 Capture only bootstrap-owned presentation capabilities, never judgment or policy facts.
 Borrowed Pi/context objects remain unfrozen; the incumbent binder checks their live capabilities.
 */
export function captureApprovalHost(input){
 if(input===undefined)return undefined;
 if((!input)||((typeof input)!=='object')
   ||isProxy(input)
   ||(Object.getPrototypeOf(input)!==Object.prototype))throw new PolicyApprovalError('Native approval host requires an ordinary bootstrap configuration');
 const required=[
   'pi',
   'ctx',
   'askUser',
   'verdictEntryType',
   'trace'
 ];
   const allowed=new Set([
   ...required,
   'notificationInvoker'
 ]); const values={};
 for(const key of Reflect.ownKeys(input)){
  if(!allowed.has(key))throw new PolicyApprovalError('Native approval host accepts presentation capabilities only; original request and judgment owners cannot be supplied here');
  const field=Object.getOwnPropertyDescriptor(
    input,
    key
  );
  if((!field?.enumerable)||(!Object.hasOwn(
    field,
    'value'
  )))throw new PolicyApprovalError('Native approval host requires data properties, not accessors');
  values[key]=field.value;
 }
 if(required.some(function isMissingApprovalCapability(key) { return (!Object.hasOwn(
   values,
   key
 )); }))throw new PolicyApprovalError('Native approval host requires Pi, context, askUser, verdict entry type and trace capabilities');
 if((!values.pi)||((typeof values.pi)!=='object')
   ||(!values.ctx)
   ||((typeof values.ctx)!=='object')
   ||((typeof values.askUser)!=='function')
   ||((typeof values.trace)!=='function')
   ||((typeof values.verdictEntryType)!=='string')
   ||(!values.verdictEntryType))throw new PolicyApprovalError('Native approval host has unsupported presentation capability types');
 if((values.notificationInvoker!==undefined)&&((typeof values.notificationInvoker)!=='function'))throw new PolicyApprovalError('Native approval notification invoker must be callable when supplied');
 return Object.freeze(values);
}

/**
 Fix the presentation source at bootstrap and capture native capabilities for each original review.
 Reloaded runners issue new contexts; a retained old context must never stand in for the active one.
 The source receives no request, judgment, authority or semantic inputs.
 */
export function captureApprovalHostSource(input){
 if((typeof input)==='function'){
  if(isProxy(input))throw new PolicyApprovalError('Native approval capability source must be an original bootstrap function');
  return function captureCurrentApprovalHost(){return captureApprovalHost(input());};
 }
 const host=captureApprovalHost(input);
 return function captureFixedApprovalHost(){return host;};
}

/** One prepared operation shares its original presentation capture across automatic and manual review. */
export function createApprovalHostOperation(captureSource){
 const l=tagged({tag:createApprovalHostOperation.name,l:tagged({tag:'auto-mode-approval'})});
 l.debug('opening original presentation capability scope');
 const state={closed:false,captured:false,host:undefined,failure:undefined};
 function captureHost(){
  const cl=tagged({tag:captureHost.name,l});
  cl.debug('reading original operation presentation capabilities');
  if(state.closed)throw new PolicyApprovalError('The original approval capability scope has ended');
  if(state.failure){cl.debug('rethrowing the original capture failure');throw state.failure.error;}
  if(state.captured){cl.debug('retaining the original captured presentation view');return state.host;}
  state.captured=true;
  try{
   state.host=captureSource();
   return state.host;
  }catch(error){
   cl.debug(caughtValueText(error));
   state.failure={error};
   throw error;
  }
 }
 function closeApprovalOperation(){
  tagged({tag:closeApprovalOperation.name,l}).debug('retiring original presentation capability scope');
  state.closed=true;
  state.host=undefined;
  state.failure=undefined;
 }
 return Object.freeze({
  captureHost,
  [Symbol.dispose]:closeApprovalOperation
 });
}
