import {SourceCollectionError} from '../collector.mjs';
import {ordinary,dense} from './message-publication-shape.mjs';
import {createMessageSignature,sameSignature} from './message-publication-signature.mjs';

//region Original capture ownership controls registration and retirement in the caller-owned alias index.
/** Publish one existing emitter input; only the original run owner holds the construction method. */
export function createMessagePublication({
  aliases,
  source,
  input,
  initialKind
}){
 const {partCount,signature}=createMessageSignature(input);
 const publicationState={captured:false,failure:undefined};
 function retire(message){publicationState.failure??=new SourceCollectionError(message);return false;}
 function current(value){
  const known=aliases.get(value);
  if(publicationState.failure||(known?.owner!==owner))return false;
  const actual=signature({
    value,
    kind:known.kind,
    ordinal:known.ordinal
  });
  if((!actual)||(!sameSignature({
    actual,
    expected:known.signature
  })))return retire('Original message contribution changed before native consumption');
  return true;
 }
 function register({
   value,
   kind,
   ordinal
 }){
  if(publicationState.failure)return false;
  const existing=aliases.get(value);
  if(existing){
   if((existing.owner!==owner)||(existing.kind!==kind)
     ||(existing.ordinal!==ordinal))return retire('Native handler projection already belongs to a different original input or position');
   return current(value);
  }
  const actual=signature({
    value,
    kind,
    ordinal
  });
  if(!actual)return retire('Native handler projection differs from its original input');
  aliases.set(
    value,
    {
      owner,
      kind,
      ordinal,
      signature:actual
    }
  );return true;
 }
 function registerLlm(value){
  if(!register({
    value,
    kind:'llm'
  }))return;
  for(const [ordinal,part] of value.content
    .entries())register({
    value:part,
    kind:'part',
    ordinal
  });
 }
 const view=Object.freeze({
   occurrence:Object.freeze({}),
   sourceOccurrence:source.occurrence,
   ...(source.runOccurrence?{runOccurrence:source.runOccurrence}:{}),
   ...(source.sessionInputOccurrence?{sessionInputOccurrence:source.sessionInputOccurrence}:{}),
   matchesPayload(value){return (aliases.get(value)
     ?.kind
     ==='payload')&&current(value);}
 });
 function beginCapture(){
  if(publicationState.captured||publicationState.failure)throw new SourceCollectionError('Handler publication cannot reuse its original construction');
  publicationState.captured=true;
 }
 /** Input-only aliases retain historical source membership, never current content or payload eligibility. */
 function retainInput(value){
  if(!ordinary(value))return false;
  const existing=aliases.get(value);
  if(existing&&((existing.owner!==owner)||(existing.kind!=='input-only')))return retire('Native input copy already belongs to another original publication');
  aliases.set(
    value,
    {
      owner,
      kind:'input-only'
    }
  );return true;
 }
 const owner=Object.freeze({
   view,
   current,
   captureInput(value){beginCapture();if(!retainInput(value))throw publicationState.failure??new SourceCollectionError('Native input occurrence requires its original ordinary message');},
   capture(value){
   beginCapture();
   if(initialKind==='llm')registerLlm(value);
   else if(!register({
     value,
     kind:'custom'
   }))throw publicationState.failure;
   if(publicationState.failure)throw publicationState.failure;
  },
   copy({
     before,
     after
   }){
   const known=aliases.get(before);
   if((known?.owner===owner)&&(known.kind==='input-only')){retainInput(after);return;}
   if(!current(before))return;
   const {
     kind,
     ordinal
   }=aliases.get(before);
   if(kind==='llm')registerLlm(after);
   else register({
     value:after,
     kind,
     ordinal
   });
  },
   entry({
     before,
     after
   }){
   const known=aliases.get(before);
   if((known?.owner===owner)&&(known.kind==='input-only')){retainInput(after);return;}
   if(current(before)&&(known.kind==='custom'))register({
     value:after,
     kind:'entry'
   });
  },
   project({
     before,
     after
   }){
   const known=aliases.get(before);
   if((known?.owner===owner)&&(known.kind==='input-only')){retainInput(after);return;}
   if(current(before)&&(known.kind==='entry'))register({
     value:after,
     kind:'custom'
   });
  },
   convert({
     before,
     after
   }){
   const known=aliases.get(before);
   if((known?.owner===owner)&&(known.kind==='input-only')){retainInput(after);return;}
   if(current(before)&&(known.kind==='custom'))registerLlm(after);
  },
   payload({
     content,
     after
   }){
   if(publicationState.failure||(!dense(content))
     ||(content.length!==partCount))return;
   for(const [ordinal,part] of content.entries()){
    const known=aliases.get(part);
    if((known?.owner!==owner)||(known.kind!=='part')
      ||(known.ordinal!==ordinal)
      ||(!current(part)))return;
   }
   register({
     value:after,
     kind:'payload'
   });
  }
 });
 return owner;
}

//endregion
