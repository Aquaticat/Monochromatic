import {types} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';

/** Copy ordinary data iteratively, rejecting cycles without imposing a depth or size ceiling. */
function copyOrdinaryData({
  input,
  sharedReferences
}){
  const holder={};
    const pending=[{
    value:input,
    parent:holder,
    key:'value'
  }];
    const seen=new Set();
    const active=new Set();
  // Metadata keeps non-enumerable data in an owned JSON view. Message cloning remains unchanged.
  function retainCopy({
    parent,
    key,
    value
  }){
    Object.defineProperty(
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
    if(entry.leave){active.delete(entry.value);continue;}
    const {
      value,
      parent,
      key:inputKey
    }=entry;
    if((value===undefined)||(value===null)
      ||((typeof value)==='boolean')){retainCopy({
      parent,
      key:inputKey,
      value
    });continue;}
    if((typeof value)==='number'){if(!Number.isFinite(value))throw new SourceCollectionError('Run message number must be finite');retainCopy({
      parent,
      key:inputKey,
      value
    });continue;}
    if((typeof value)==='string'){retainCopy({
      parent,
      key:inputKey,
      value
    });continue;}
    if(types.isProxy(value))throw new SourceCollectionError('Run message data requires ordinary non-proxy values');
    if(((typeof value)!=='object')||((!sharedReferences)&&seen.has(value)))throw new SourceCollectionError('Run message data requires a non-aliased ordinary tree');
    if(active.has(value))throw new SourceCollectionError('Tool metadata contains a cycle');
    active.add(value);
    pending.push({leave:true,value});
    seen.add(value);const array=Array.isArray(value);
    const prototype=Object.getPrototypeOf(value);
    if(array?prototype!==Array.prototype:prototype!==Object.prototype)throw new SourceCollectionError('Run message data has an unsupported prototype');
    const keys=Reflect.ownKeys(value);if(array&&(keys.length!==(value.length
      +1)))throw new SourceCollectionError('Run message container has sparse or extra entries');
    const target=array?[]:{};
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
          &&(!(array&&(key==='length')))))throw new SourceCollectionError(`Run message data requires named data properties: ${String(key)}`);
      if(array&&(key==='length'))continue;
      // Reserve owned slots in original order before the work stack visits their values.
      retainCopy({
        parent:target,
        key,
        value:undefined
      });
      pending.push({
        value:property.value,
        parent:target,
        key
      });
    }
  }
  const copy=holder.value;
  const freeze=[copy];while(freeze.length > 0){const value=freeze.pop();if((!value)||((typeof value)!=='object'))continue;for(const child of Object.values(value))freeze.push(child);Object.freeze(value);}return copy;
}
/** Copy message trees without changing the incumbent rejection of aliases and cycles. */
export function copyMessageData(input){return copyOrdinaryData({
  input,
  sharedReferences:false
});}

/** Copy each shared metadata occurrence independently while rejecting ancestor cycles. */
export function copyToolMetadata(input){return copyOrdinaryData({
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
  return Object.freeze(result);
}
