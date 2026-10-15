import {SourceCollectionError} from '../collector.mjs';

/** Validate copied records as JSON data without another parse or a representation change. */
function assertJSONRecord({
  value,
  label
}){
 if((!value)||((typeof value)!=='object')
   ||Array.isArray(value))throw new SourceCollectionError(`${label} requires an ordinary JSON object`);
 const pending=[value];
 while(pending.length > 0){
  const item=pending.pop();
  if((item===undefined)||(((typeof item)==='number')
    &&Object.is(
    item,
    -0
  )))throw new SourceCollectionError(`${label} requires values preserved by JSON serialization`);
  if(item&&((typeof item)==='object'))pending.push(...Object.values(item));
 }
}

/** Preserve received declaration/removal records without re-normalizing the native producer's JSON data. */
export function assertManagerSystemTools(input){
 for(const field of [
   'toolsAdded',
   'toolsRemoved'
 ]){
  const records=input[field];if(records===undefined)continue;
  if(!Array.isArray(records))throw new SourceCollectionError(`Native manager ${field
    } requires its declaration or removal array`);
  for(const value of records)assertJSONRecord({
    value,
    label:`Native manager ${field} record`
  });
 }
}

/** Keep complete supported native content blocks; signatures remain opaque data, never authority. */
export function assertManagerMessageContent(content){
 if((content===undefined)||(content===null)
   ||((typeof content)==='string'))return;
 if(!Array.isArray(content))throw new SourceCollectionError('Native manager message content requires text or supported content blocks');
 for(const part of content){
  if((!part)||((typeof part)!=='object')
    ||Array.isArray(part))throw new SourceCollectionError('Native manager content blocks require ordinary records');
  let keys;
  if(part.type==='text'){
   keys=[
     'type',
     'text',
     'textSignature'
   ];
   if(((typeof part.text)!=='string')||((part.textSignature!==undefined)&&((typeof part.textSignature)!=='string')))throw new SourceCollectionError('Native manager text content requires text and an optional text signature');
  }else if(part.type==='thinking'){
   keys=[
     'type',
     'thinking',
     'thinkingSignature',
     'redacted'
   ];
   if(((typeof part.thinking)!=='string')||((part.thinkingSignature!==undefined)&&((typeof part.thinkingSignature)!=='string'))
     ||((part.redacted!==undefined)&&((typeof part.redacted)!=='boolean')))throw new SourceCollectionError('Native manager thinking content requires its native text and signature fields');
  }else if(part.type==='toolCall'){
   keys=[
     'type',
     'id',
     'name',
     'arguments',
     'thoughtSignature',
     'namespace'
   ];
   if(((typeof part.id)!=='string')||((typeof part.name)!=='string')
     ||((part.thoughtSignature!==undefined)&&((typeof part.thoughtSignature)!=='string'))
     ||((part.namespace!==undefined)&&((typeof part.namespace)!=='string')))throw new SourceCollectionError('Native manager tool-call content requires its native identity and signature fields');
   assertJSONRecord({
     value:part.arguments,
     label:'Native manager tool-call arguments'
   });
  }else throw new SourceCollectionError('Native manager message content has an unsupported block type');
  if(Object.keys(part)
    .some(function isUnexpectedMessageField(key) { return (!keys.includes(key)); }))throw new SourceCollectionError('Native manager content block has unsupported fields');
 }
}
