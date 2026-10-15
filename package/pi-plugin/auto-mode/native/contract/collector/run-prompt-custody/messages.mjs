import {types} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';

/** Validate every serialized occurrence under one budget before cloning; depth also rejects cycles. */
function copyBoundedData({
  input,
  sharedReferences
}){
  const holder={};
    const pending=[{
    value:input,
    depth:0,
    path:'$',
    parent:holder,
    key:'value'
  }];
    const seen=new Set();let bytes=0;
    let nodes=0;
  // Metadata keeps non-enumerable data in an owned JSON view. Message cloning remains unchanged.
  function retainCopy({
    parent,
    key,
    value
  }){
    if(sharedReferences)Object.defineProperty(
      parent,
      key,
      {
        value,
        enumerable:true,
        writable:true,
        configurable:true
      }
    );
  }
  while(pending.length > 0){
    const entry=pending.pop();
    const {
      value,
      depth,
      path,
      parent,
      key:inputKey
    }=entry;if(depth>32)throw new SourceCollectionError('Run message data exceeds depth bound');
    if((value===undefined)||(value===null)
      ||((typeof value)==='boolean')){bytes+=5;retainCopy({
      parent,
      key:inputKey,
      value
    });continue;}
    if((typeof value)==='number'){if(!Number.isFinite(value))throw new SourceCollectionError('Run message number must be finite');bytes+=24;retainCopy({
      parent,
      key:inputKey,
      value
    });continue;}
    if((typeof value)==='string'){bytes+=Buffer.byteLength(JSON.stringify(value));if(bytes>1_048_576)throw new SourceCollectionError('Run message data exceeds byte bound');retainCopy({
      parent,
      key:inputKey,
      value
    });continue;}
    if(types.isProxy(value))throw new SourceCollectionError('Run message data requires ordinary non-proxy values');
    if(((typeof value)!=='object')||((!sharedReferences)&&seen.has(value))
      ||((++nodes)>4_096))throw new SourceCollectionError(sharedReferences?'Tool metadata exceeds the bounded expanded ordinary-data profile':'Run message data requires a bounded non-aliased ordinary tree');
    seen.add(value);const array=Array.isArray(value);
    const prototype=Object.getPrototypeOf(value);
    if(array?prototype!==Array.prototype:prototype!==Object.prototype)throw new SourceCollectionError('Run message data has an unsupported prototype');
    const keys=Reflect.ownKeys(value);if((keys.length>4_097)||(array&&((value.length>4_096)||(keys.length!==(value.length
      +1)))))throw new SourceCollectionError('Run message container exceeds bound or has sparse/extra entries');
    bytes+=2+(keys.length
      *2);if(bytes>1_048_576)throw new SourceCollectionError('Run message data exceeds byte bound');
    const target=sharedReferences?(array?[]:{}):undefined;
    retainCopy({
      parent,
      key:inputKey,
      value:target
    });
    for(const key of keys){
      const property=Object.getOwnPropertyDescriptor(
        value,
        key
      );
      if(((typeof key)!=='string')||(!property)
        ||(!Object.hasOwn(
        property,
        'value'
      ))
        ||((!property.enumerable)&&(!sharedReferences)
          &&(!(array&&(key==='length')))))throw new SourceCollectionError(`Run message data requires named data properties at ${path}[${String(key)}]`);
      if(array&&(key==='length'))continue;bytes+=Buffer.byteLength(JSON.stringify(key));if(bytes>1_048_576)throw new SourceCollectionError('Run message data exceeds byte bound');
      // Reserve owned slots in original order before the work stack visits their values.
      retainCopy({
        parent:target,
        key,
        value:undefined
      });
      pending.push({
        value:property.value,
        depth:depth+1,
        path:`${path}[${JSON.stringify(key)}]`,
        parent:target,
        key
      });
    }
  }
  const copy=sharedReferences?holder.value:structuredClone(input);
  if(Buffer.byteLength(JSON.stringify({value:copy}))>1_048_576)throw new SourceCollectionError('Complete run message data exceeds byte bound');
  const freeze=[copy];while(freeze.length > 0){const value=freeze.pop();if((!value)||((typeof value)!=='object'))continue;freeze.push(...Object.values(value));Object.freeze(value);}return copy;
}
/** Copy message trees without changing the incumbent rejection of aliases and cycles. */
export function copyMessageData(input){return copyBoundedData({
  input,
  sharedReferences:false
});}

/** Shared declaration metadata is charged for each JSON occurrence, never deduplicated or given per-tool budgets. */
export function copyToolMetadata(input){return copyBoundedData({
  input,
  sharedReferences:true
});}

/** Restrict semantic source material to the incumbent text-content profile after ordinary data copying. */
export function assertTextMessageContent(content){
  if((content!==undefined)&&(content!==null)
    &&((typeof content)!=='string')){
    if((!Array.isArray(content))||content.some(function isUnsupportedMessagePart(part) { return ((!part)
      ||((typeof part)!=='object')
      ||(part.type!=='text')
      ||((typeof part.text)!=='string')
      ||Object.keys(part)
      .some(function isUnexpectedTextPartField(key) { return ((key!=='type')&&(key!=='text')); })); }))throw new SourceCollectionError('Run message profile supports text content only');
  }
}
/** Message paths/types are data; no role, customType or display flag grants authority. */
export function snapshotRunMessages(messages){
  if((!Array.isArray(messages))||(Object.getPrototypeOf(messages)!==Array.prototype)
    ||(messages.length>64)
    ||(Reflect.ownKeys(messages)
      .length
      !==(messages.length
      +1)))throw new SourceCollectionError('Run messages require a bounded dense array');
  const result=[];
  for(let index=0;index<messages.length;index++){
    const entry=Object.getOwnPropertyDescriptor(
      messages,
      String(index)
    );if((!entry?.enumerable)||(!Object.hasOwn(
      entry,
      'value'
    )))throw new SourceCollectionError('Run message entry is missing or accessor-backed');
    const value=copyMessageData(entry.value);
    if((!value)
      ||Array.isArray(value)
      ||((typeof value)!=='object')
      ||Reflect.ownKeys(value)
      .some(function isUnexpectedCustomMessageField(key) { return (![
      'customType',
      'content',
      'display',
      'details'
    ].includes(key)); })
      ||((typeof value.customType)!=='string')
      ||((typeof value.display)!=='boolean'))throw new SourceCollectionError('Run custom message differs from its declared native shape');
    assertTextMessageContent(value.content);
    result.push(value);
  }
  if(Buffer.byteLength(JSON.stringify(result))>1_048_576)throw new SourceCollectionError('Combined run messages exceed byte bound');return Object.freeze(result);
}
