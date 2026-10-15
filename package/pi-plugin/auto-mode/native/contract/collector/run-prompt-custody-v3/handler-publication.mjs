import {field,dense,textPart} from './message-publication-shape.mjs';
import {createMessagePublication} from './message-publication-owner.mjs';
import {SourceCollectionError} from '../collector.mjs';
import {publishSystemToolInput} from './system-tool-publication.ts';
import {copyMessageData} from '../run-prompt-custody/messages.mjs';
import {tagged} from '@monochromatic-dev/module-logger/ts';

// This index holds aliases of existing source capabilities, never another source/content inventory.
const aliases=new WeakMap();

/** Original loaded values retain input identity only; no text-part or payload capability is issued. */
export function createInputOnlyPublication({source,systemInput}){
 const publication=createMessagePublication({
   aliases,
   source,
   input:{},
   initialKind:'input-only'
 });
 return Object.freeze({
   view:publication.view,
   capture(value){
    publication.captureInput(value);
    if(systemInput)publishSystemToolInput({
      aliases,
      publication:publication.view,
      message:systemInput.message,
      expected:systemInput.expected,
      copyInput:copyMessageData,
      InputError:SourceCollectionError
    });
   }
 });
}

/** Original handler construction starts as a custom message before native LLM conversion. */
export function createHandlerPublication({
  source,
  input
}){return createMessagePublication({
   aliases,
  source,
  input,
  initialKind:'custom'
});}

/** Publish only the exact text-only expanded-prompt shape; other native image/hint paths stay unassociated. */
export function createExpandedPromptPublication(source){
 const publication=createMessagePublication({
   aliases,
   source,
   input:{content:source.content},
   initialKind:'llm'
 });
 const captureState={observed:false};
 return Object.freeze({
   view:publication.view,
   capture(message){
  if(captureState.observed)throw new SourceCollectionError('Expanded prompt publication cannot reuse its original construction');
  captureState.observed=true;
  if(field({value:message,key:'role'})
    ?.value
    !=='user')return;
  const content=field({value:message,key:'content'})
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
   .filter(function isContextEditEntry(row) { return (field({value:row.sourceEntry,key:'type'})
     ?.value
     ==='context_edit'); })
   .map(function readContextEditTarget(row) { return (field({value:row.sourceEntry,key:'targetId'})
     ?.value); }));
 for(const {
   sourceEntry,
   messages
 } of projection.entries){
  if(edited.has(field({value:sourceEntry,key:'id'})
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
 const content=field({value:before,key:'content'})
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
   'input-only',
   'system-input'
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

/** Original tool declarations retain existing source membership only while their native input remains current. */
export function readOriginalToolPublication(value){
 const known=aliases.get(value);
 return (known?.kind==='tool-declaration')
   &&known.owner
   .current(value)?known.owner
     .view:undefined;
}

/** Original serializer values are captured before callbacks; unsupported native data retains its failure. */
export function snapshotOriginalToolEmission({
  tool,
  converted
}){
 const l=tagged({tag:'auto-mode-handler-publication'});
 const fl=tagged({
   tag:snapshotOriginalToolEmission.name,
   l
 });
 fl.debug('capturing original converted tool data before payload callbacks');
 try{return Object.freeze({
   tool,
   value:copyMessageData(converted)
 });}
 catch(error){
  fl.debug(String(error));
  return Object.freeze({
    tool,
    error
  });
 }
}

/** Original system fields retain captured input membership only while the native message remains current. */
export function readOriginalSystemPublication(value){
 const known=aliases.get(value);
 return (known?.kind==='system-input')
   &&known.owner
   .current(value)?known.owner
     .view:undefined;
}
