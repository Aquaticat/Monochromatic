import {
  isDeepStrictEqual,
  types
} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';

// This index holds aliases of existing source capabilities, never another source/content inventory.
const aliases=new WeakMap();

function ordinary(value){
 return (value!==null)&&((typeof value)==='object')
   &&(!types.isProxy(value))
   &&(Object.getPrototypeOf(value)===Object.prototype)
   &&(!('toJSON' in value));
}
function field(
  value,
  key
){
 if(!ordinary(value))return undefined;
 const property=Object.getOwnPropertyDescriptor(
   value,
   key
 );
 return property?.enumerable&&Object.hasOwn(
   property,
   'value'
 )?property:undefined;
}
function dense(value){
 return Array.isArray(value)
   &&(!types.isProxy(value))
   &&(Object.getPrototypeOf(value)===Array.prototype)
   &&(!('toJSON' in value))
   &&(Reflect.ownKeys(value)
     .length
     ===(value.length
     +1))
   &&Array.from(
     {length:value.length},
     function readArrayDescriptor(
       _,
       index
     ) { return (Object.getOwnPropertyDescriptor(
       value,
       String(index)
     )); }
   )
   .every(function isEnumerableDataProperty(property) { return (property?.enumerable&&Object.hasOwn(
     property,
     'value'
   )); });
}
function textPart(value){
 return ordinary(value)&&(Reflect.ownKeys(value)
   .length
   ===2)
   &&(field(
     value,
     'type'
   )
     ?.value
     ==='text')
   &&((typeof field(
     value,
     'text'
   )
     ?.value)==='string');
}
function flags(property){
 return Object.freeze({
   enumerable:property.enumerable,
   writable:property.writable,
   configurable:property.configurable
 });
}

/** Publish one existing emitter input; only the original run owner holds the construction method. */
function createMessagePublication({
  source,
  input,
  initialKind
}){
 const raw=input.content??[];
 const partCount=(typeof raw)==='string'?1:raw.length;
 let captured=false;
 let failure;
 function textAt(index){return (typeof raw)==='string'?raw:raw[index]
   .text;}
 function retire(message){failure??=new SourceCollectionError(message);return false;}
 function validContent({
   value,
   kind
 }){
  if((kind==='custom')||(kind==='entry')){
   if((typeof raw)==='string')return value===raw;
   return dense(value)&&(value.length===partCount)
     &&value.every(function matchesOriginalTextPart(
       part,
       index
     ) { return (textPart(part)&&(part.text===textAt(index))); });
  }
  if((!dense(value))||(!value.every(textPart)))return false;
  if(kind==='llm')return (value.length===partCount)&&value.every(function matchesPublishedText(
    part,
    index
  ) { return (part.text===textAt(index)); });
  if(kind==='payload'){
   let ordinal=0;
   for(let index=0;index<partCount;index++){
    const text=textAt(index);if(text.length===0)continue;
    if((!text.isWellFormed())||(value[ordinal]
      ?.text
      !==text))return false;
    ordinal++;
   }
   return (ordinal>0)&&(ordinal===value.length);
  }
  return false;
 }
 function signature({
   value,
   kind,
   ordinal
 }){
  if(kind==='part'){
   if((!textPart(value))||(value.text!==textAt(ordinal)))return undefined;
   return Object.freeze({
     type:flags(field(
       value,
       'type'
     )),
     text:flags(field(
       value,
       'text'
     ))
   });
  }
  const label=field(
    value,
    kind==='entry'?'type':'role'
  ); const content=field(
    value,
    'content'
  );
  const expected=kind==='entry'?'custom_message':kind==='custom'?'custom':'user';
  if((!label)||(label.value!==expected)
    ||(!content)
    ||(!validContent({
      value:content.value,
      kind
    })))return undefined;
  const parts=Array.isArray(content.value)?Object.freeze(content.value
    .map(function captureTextPartDescriptors(
      part,
      index
    ) { return (Object.freeze({
      part,
      index:flags(Object.getOwnPropertyDescriptor(
        content.value,
        String(index)
      )),
      type:flags(field(
        part,
        'type'
      )),
      text:flags(field(
        part,
        'text'
      ))
    })); })):undefined;
  return Object.freeze({
    label:flags(label),
    content:flags(content),
    contentValue:content.value,
    parts,
    length:parts?flags(Object.getOwnPropertyDescriptor(
      content.value,
      'length'
    )):undefined
  });
 }
 function sameSignature({
   actual,
   expected
 }){
  if((actual.contentValue!==expected.contentValue)||(!isDeepStrictEqual(
    actual.label,
    expected.label
  ))
    ||(!isDeepStrictEqual(
      actual.content,
      expected.content
    ))
    ||(!isDeepStrictEqual(
      actual.type,
      expected.type
    ))
    ||(!isDeepStrictEqual(
      actual.text,
      expected.text
    ))
    ||(!isDeepStrictEqual(
      actual.length,
      expected.length
    )))return false;
  if((!actual.parts)||(!expected.parts))return actual.parts===expected.parts;
  return (actual.parts
    .length
    ===expected.parts
    .length)
    &&actual.parts
    .every(function matchesCapturedPart(
    part,
    index
  ) {
   const original=expected.parts[index];
   return (part.part===original.part)&&isDeepStrictEqual(
     part.index,
     original.index
   )
     &&isDeepStrictEqual(
     part.type,
     original.type
   )
     &&isDeepStrictEqual(
     part.text,
     original.text
   );
  });
 }
 function current(value){
  const known=aliases.get(value);
  if(failure||(known?.owner!==owner))return false;
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
  if(failure)return false;
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
  if(captured||failure)throw new SourceCollectionError('Handler publication cannot reuse its original construction');
  captured=true;
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
   captureInput(value){beginCapture();if(!retainInput(value))throw failure??new SourceCollectionError('Native input occurrence requires its original ordinary message');},
   capture(value){
   beginCapture();
   if(initialKind==='llm')registerLlm(value);
   else if(!register({
     value,
     kind:'custom'
   }))throw failure;
   if(failure)throw failure;
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
   if(failure||(!dense(content))
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

/** Original loaded values retain input identity only; no text-part or payload capability is issued. */
export function createInputOnlyPublication(source){
 const publication=createMessagePublication({
   source,
   input:{},
   initialKind:'input-only'
 });
 return Object.freeze({
   view:publication.view,
   capture:publication.captureInput
 });
}

/** Original handler construction starts as a custom message before native LLM conversion. */
export function createHandlerPublication({
  source,
  input
}){return createMessagePublication({
  source,
  input,
  initialKind:'custom'
});}

/** Publish only the exact text-only expanded-prompt shape; other native image/hint paths stay unassociated. */
export function createExpandedPromptPublication(source){
 const publication=createMessagePublication({
   source,
   input:{content:source.content},
   initialKind:'llm'
 });
 let observed=false;
 return Object.freeze({
   view:publication.view,
   capture(message){
  if(observed)throw new SourceCollectionError('Expanded prompt publication cannot reuse its original construction');
  observed=true;
  if(field(
    message,
    'role'
  )
    ?.value
    !=='user')return;
  const content=field(
    message,
    'content'
  )
    ?.value;
  if((!dense(content))||(content.length!==1)
    ||(!textPart(content[0]))
    ||(content[0]
      .text
      !==source.content)){publication.captureInput(message);return;}
  publication.capture(message);
 }
 });
}

/** Trusted native copy sites retain only already-known capabilities, without reading accessor values. */
export function copyHandlerAlias({
  before,
  after
}){aliases.get(before)
  ?.owner
  .copy({
    before,
    after
  });}

/** The native append call supplies the original message only to this observer, never to persisted data. */
export function recordHandlerEntry({
  before,
  after
}){aliases.get(before)
  ?.owner
  .entry({
    before,
    after
  });}

/** An actual native constructor identifies its output, including summary-only output from a multi-message entry. */
export function recordMessageInputProjection({
  before,
  after
}){aliases.get(before)
  ?.owner
  .project({
    before,
    after
  });}

/** The native projection's existing sourceEntry/message relation is the bridge, never an entry ID match. */
export function recordHandlerProjection(projection){
 const edited=new Set(projection.entries
   .filter(function isContextEditEntry(row) { return (field(
     row.sourceEntry,
     'type'
   )
     ?.value
     ==='context_edit'); })
   .map(function readContextEditTarget(row) { return (field(
     row.sourceEntry,
     'targetId'
   )
     ?.value); }));
 for(const {
   sourceEntry,
   messages
 } of projection.entries){
  if(edited.has(field(
    sourceEntry,
    'id'
  )
    ?.value)||(messages.length!==1))continue;
  recordMessageInputProjection({
    before:sourceEntry,
    after:messages[0]
  });
 }
}

/** The manager can propagate existing input aliases before a native session attaches its run observer. */
export function observeMessageCopies(value){
 if((value.kind==='selected-path')||(value.kind==='appended-entry'))return;
 if(value.kind==='handler-entry'){recordHandlerEntry({
   before:value.before[0],
   after:value.after[0]
 });return;}
 if(value.kind==='projection'){recordHandlerProjection(value.projection);return;}
 for(const [index,before] of value.before
   .entries())copyHandlerAlias({
   before,
   after:value.after[index]
 });
}

/** Fixed native custom conversion republishes its actual result. Labels and equal copies do not enter the index. */
export function recordHandlerConversion({
  before,
  after
}){aliases.get(before)
  ?.owner
  .convert({
    before,
    after
  });}

/** Fixed native serializer observes its actual user-content construction after text filtering. */
export function recordHandlerPayload({
  before,
  after
}){
 const content=field(
   before,
   'content'
 )
   ?.value;
 if((!dense(content))||(content.length === 0))return;
 aliases.get(content[0])
   ?.owner
   .payload({
     content,
     after
   });
}

/** Retain an original input even after its contribution retires; this never authenticates its current contents. */
export function readOriginalMessagePublication(value){
 const known=aliases.get(value);
 return known&&[
   'custom',
   'entry',
   'llm',
   'input-only'
 ].includes(known.kind)?known.owner
   .view:undefined;
}

/** Only a known original payload occurrence can supply a candidate for the request observer. */
export function readHandlerPayloadPublication(value){
 const known=aliases.get(value);
 return (known?.kind==='payload')
   &&known.owner
   .current(value)?known.owner
     .view:undefined;
}
