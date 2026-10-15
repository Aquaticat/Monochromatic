import {isDeepStrictEqual} from 'node:util';
import {NativeSourceAssociationError} from './source-association-error.mjs';

//region Serialized output consumes retained original contribution evidence once.
export function createAssociationSealer({state,reason,toolAssociation}){
 function seal(parsed){
  if(state.sealed)throw new NativeSourceAssociationError('Native source contribution was already sealed');
  state.sealed=true;
  const expected=state.owned;
  const missing=state.unresolvedHandlers;
  state.owned=[];state.unresolvedHandlers=[];
  const result=[];
  function append({
    ordinal,
    associations,
    why,
    serialization,
    derivation
  }){
   const location=Object.freeze({
     field:'messages',
     ordinal,
     property:'content'
   });
   for(const association of associations)result.push(Object.freeze({
     contribution:Object.freeze({}),
     location,
     association,
     ...(serialization?{serialization}:{}),
     ...(derivation?{systemDerivation:derivation}:{}),
     reason:why,
     coverage:'partial-original-prompt-input-contribution',
     permission:false
   }));
  }
  const system=expected.find(function readSystemReceipt(record) { return (record.system); });
    const systemOrdinal=system?.ordinal??0;
    const systemMessage=parsed.messages?.[systemOrdinal];
  if(systemMessage&&[
    'system',
    'developer'
  ].includes(systemMessage.role)
    &&((typeof systemMessage.content)==='string')){
   const associated=(system!==undefined)&&(systemMessage.role
     ===system.message
     .role)
     &&(systemMessage.content
       ===system.message
       .content);
   append({
     ordinal:systemOrdinal,
     associations:associated?system.associations:[undefined],
     serialization:associated?system.serialization:undefined,
     derivation:associated?system.derivation:undefined,
     why:associated?undefined:state.payloadOriginFailure??reason
       ??'The payload callback replaced or changed the original native contribution'
   });
  }
  for(const record of expected){
   if(record.system)continue;
   const message=parsed.messages?.[record.ordinal];
   const associated=(message?.role
     ===record.message
     .role)&&isDeepStrictEqual(
     message.content,
     record.message
       .content
   );
   append({
     ordinal:record.ordinal,
     associations:associated?record.associations:[undefined],
     why:associated?undefined:'Serialized message content differs from its owned original payload'
   });
  }
  for(const item of missing)result.push(Object.freeze({
    contribution:Object.freeze({}),
    location:item.location,
    association:undefined,
    reason:item.reason,
    coverage:'partial-original-prompt-input-contribution',
    permission:false
  }));
  return Object.freeze([
    ...result,
    ...toolAssociation.seal(parsed)
  ]);
 }
 return seal;
}
//endregion
