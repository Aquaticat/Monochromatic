import {types} from 'node:util';

//region Diagnostics read only original error data without invoking accessors.
/** Preserve deciding nested error messages in host UIs that display only the outer message. */
export function captureFailureMessage(errors){
 const pending=[...errors].reverse();
 const seen=new Set();
 const messages=[];
 while(pending.length>0){
  const error=pending.pop();
  if(types.isProxy(error)||(!types.isNativeError(error))||seen.has(error))continue;
  seen.add(error);
  const message=Object.getOwnPropertyDescriptor(error,'message')?.value;
  if(typeof message==='string')messages.push(message);
  const nested=Object.getOwnPropertyDescriptor(error,'errors')?.value;
  if(types.isProxy(nested)||(!Array.isArray(nested)))continue;
  for(let index=nested.length-1;index>=0;index--){
   const item=Object.getOwnPropertyDescriptor(nested,String(index));
   if(item&&Object.hasOwn(item,'value'))pending.push(item.value);
  }
 }
 return messages.join('\n');
}
//endregion
