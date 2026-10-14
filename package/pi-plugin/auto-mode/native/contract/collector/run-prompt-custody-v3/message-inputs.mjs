import {createHash} from 'node:crypto';
import {SourceCollectionError} from '../collector.mjs';

/**
 Represent content from an already validated native emitter snapshot.
 Preserve text-block boundaries as JSON rather than inventing Markdown clause joins.
 Opaque details remain in the original snapshot, not the semantic wire metadata.
 */
export function describeMessageInput(message){
 const text=(typeof message.content)==='string';
 const contentFormat=text?'text':'native-content-json';
 const content=text?message.content:JSON.stringify(message.content??[]);
 const metadataJSON=JSON.stringify({
   customType:message.customType,
   display:message.display,
   contentFormat
 });
 return {
   content,
   contentFormat,
   metadataJSON
 };
}

/** Capture the native expanded-text handoff, without claiming the origin of earlier transformations. */
export function captureExpandedPromptInput({
  content,
  runOccurrence
}){
 if(((typeof content)!=='string')||(Buffer.byteLength(content)>1_048_576))throw new SourceCollectionError('Expanded prompt input requires text within the original request byte bound');
 return Object.freeze({
   kind:'native-run-expanded-prompt-input',
   content,
   contentFormat:'text',
   inputLocation:Object.freeze({field:'expandedPrompt'}),
   sha256:createHash('sha256')
     .update(content)
     .digest('hex'),
   occurrence:Object.freeze({}),
   runOccurrence,
   registration:undefined,
   permission:false
 });
}

/** Original active inputs plus observed retained run inputs; disk-loaded and compacted history are not established. */
export function collectRunMessageInputs(run){
 if(!run)return Object.freeze([]);
 const active=[
   ...run.ancestors
     .toReversed(),
   run
 ].flatMap(publication=>[
   ...(publication.expandedPromptInput?[publication.expandedPromptInput]:[]),
   ...publication.handlerMessageInputs,
   ...(publication.handlerOptionInputs??[])
 ]);
 return Object.freeze([
   ...active,
   ...(run.retainedMessageOrigins??[]).map(origin=>origin.source)
 ]);
}

/** Reuse manager-owned original references before a native run exists, never mint an emitting run. */
export function collectNativeMessageInputs(sources){
 if(sources.nativeRunComposition)return collectRunMessageInputs(sources.nativeRunComposition);
 return Object.freeze((sources.nativeConstructedInputs??[]).map(origin=>origin.source));
}

/** Only inclusion in the original run publication authenticates these constructed records. */
export function captureMessageInputs({
  messages,
  runOccurrence
}){
 return Object.freeze(messages.map((
   message,
   ordinal
 )=>{
  const {
    content,
    contentFormat,
    metadataJSON
  }=describeMessageInput(message);
  return Object.freeze({
    kind:'native-run-handler-message-input',
    content,
    contentFormat,
    inputLocation:Object.freeze({
      field:'emitterMessages',
      ordinal,
      metadataJSON
    }),
    sha256:createHash('sha256')
      .update(content)
      .digest('hex'),
    occurrence:Object.freeze({}),
    runOccurrence,
    registration:undefined,
    permission:false
  });
 }));
}
