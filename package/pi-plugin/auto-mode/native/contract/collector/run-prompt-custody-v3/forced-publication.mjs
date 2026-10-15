import {isDeepStrictEqual} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';

/** Retain only the native creator's actual forced-message objects, not equal text in replacement objects. */
export function createForcedPublication(source){
 const messages=new WeakMap();
 const publication={failure:undefined};
 function fields(message){
  if((!message)||((typeof message)!=='object')
    ||(Object.getPrototypeOf(message)!==Object.prototype))throw new SourceCollectionError('Native forced publication requires its ordinary original message');
  const role=Object.getOwnPropertyDescriptor(
    message,
    'role'
  ); const content=Object.getOwnPropertyDescriptor(
    message,
    'content'
  );
  if((!role)||(!content)
    ||(!Object.hasOwn(
      role,
      'value'
    ))
    ||(!Object.hasOwn(
      content,
      'value'
    ))
    ||(role.value!=='system')
    ||(content.value!==source.content)
    ||Object.hasOwn(
    message,
    'sections'
  ))throw new SourceCollectionError('Native forced message differs from its original captured input');
  return {
    role,
    content
  };
 }
 function live(){if(publication.failure)throw new SourceCollectionError(
   'Original forced-message publication lost eligibility',
   {cause:publication.failure.cause}
 );}
 function capture(message){
  live();
  try{
   if(messages.has(message))throw new SourceCollectionError('Native forced-message publication cannot reuse a message occurrence');
   messages.set(
     message,
     fields(message)
   );
  }catch(error){publication.failure={cause:error};throw error;}
 }
 const view=Object.freeze({
   occurrence:Object.freeze({}),
   source,
   runOccurrence:source.runOccurrence,
   matchesMessage(message){
   live();const original=messages.get(message);if(!original)return false;
   try{
    if(!isDeepStrictEqual(
      fields(message),
      original
    ))throw new SourceCollectionError('Original forced message changed before serializer consumption');
    return true;
   }catch(error){publication.failure={cause:error};throw error;}
  }
 });
 return Object.freeze({
   capture,
   view
 });
}
