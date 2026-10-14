import {createHash} from 'node:crypto';
import {SourceCollectionError} from '../../collector/collector.mjs';

//region Original resource processing receipts remain independent of derived carriers.
/** Project owned resource observations without assigning file identity or source authority. */
export function createResourceReceiptInputs({frame,priorContext}){
 if(!frame||!Object.isFrozen(frame)||!Array.isArray(frame.stages)||frame.stages.map(stage=>stage.kind).join(',')!=='context,system,append')throw new SourceCollectionError('Resource receipts require the original complete native phase sequence');
 const inputs=[];
 function retain({value,phase,boundary,ordinal}){
  if(value===undefined)return;
  const contentFormat=typeof value==='string'?'text':'native-content-json';
  const content=typeof value==='string'?value:JSON.stringify(value);
  if(typeof content!=='string')throw new SourceCollectionError('Original resource receipt is not representable');
  inputs.push(Object.freeze({kind:'native-resource-received-input',content,contentFormat,
   inputLocation:Object.freeze({field:'resourceCallback',metadataJSON:JSON.stringify({phase,boundary,ordinal,resourceOrdinal:frame.ordinal})}),
   sha256:createHash('sha256').update(content).digest('hex'),occurrence:Object.freeze({}),
   resourceInputOccurrence:frame.occurrence,registration:undefined,permission:false}));
 }
 for(const [ordinal,phase] of frame.stages.entries()){
  retain({value:phase.before,phase:phase.kind,boundary:'before-callback',ordinal});
  retain({value:phase.after,phase:phase.kind,boundary:'after-callback',ordinal});
 }
 retain({value:priorContext,phase:'context',boundary:'before-policy-publication',ordinal:0});
 if(Buffer.byteLength(JSON.stringify(inputs))>1048576)throw new SourceCollectionError('Original resource receipt sources exceed the resource byte bound');
 return Object.freeze(inputs);
}

/** Keep resource reload receipts while the same loader owns their lifetime. */
export function retainResourceReceiptInputs({previous,current}){
 const inputs=Object.freeze([...previous,...current]);
 if(inputs.length>64||Buffer.byteLength(JSON.stringify(inputs))>1048576)throw new SourceCollectionError('Retained resource receipts exceed the bounded resource profile');
 return inputs;
}
//endregion
