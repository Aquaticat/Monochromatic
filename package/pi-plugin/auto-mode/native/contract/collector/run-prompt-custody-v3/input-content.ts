/**
 Retain exact native input text through shared immutable chunks and producer-owned reads.

 @module
 */
import {createHash} from 'node:crypto';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {createInputContentPieces,type ContentPage} from './input-content-pieces.ts';

//region One manager's input ledger shares storage while retaining every original source occurrence

/**
 Content identity does not issue input or permission authority.
 */
export type RetainedInputContent = {
 readonly sha256:string;
 readonly read:()=>string;
};

/**
 Only exact producer-created source/getter pairs qualify for the immutable-content accessor.
 */
const sourceContentDescriptors=new WeakMap<object,PropertyDescriptor>();

/**
 Storage diagnostics do not include retained text.
 */
const l=tagged({tag:'auto-mode-native-input-content'});

/**
 Keep the read closure separate from the caller's complete temporary serialization.

 @param pages - shared immutable text pages preserve the exact UTF-16 sequence
 
 @param sha256 - original UTF-8 digest retains the existing source contract
 
 @returns content reader without a retained flat serialization
 */
function retainContentReader({
  pages,
  sha256
}: {
  readonly pages:readonly ContentPage[];
  readonly sha256:string
}): RetainedInputContent {
 /**
  Pure reads remain transparent to freshness scans and invoke no input callbacks.

  @returns original code-unit sequence reconstructed from retained pieces
  */
 function read(): string {
  return pages.map(function readPage(page){return page.texts.join('');}).join('');
 }
 return Object.freeze({
   sha256,
   read
 });
}

/**
 Share content within one manager without merging publications or original occurrences.

 @returns content interner whose private maps have the owning pool's lifetime

 @example
 ```ts
 const retain=createInputContentStore();
 const content=retain({text:'native input',json:false});
 ```
 */
export function createInputContentStore(): (input:{
  readonly text:string;
  readonly json:boolean
})=>RetainedInputContent {
 /**
  Storage diagnostics retain the owning manager's boundary without its text.
  */
 const sl=tagged({
   tag:createInputContentStore.name,
   l
 });
 sl.debug('created manager-owned immutable input content store');
 /**
  Shared pages retain chunk arrays once rather than once per complete version.
  */
 const retainPieces=createInputContentPieces();
 /**
  Complete chunk-identity sequences preserve equality independently of hashing.
  */
 const contents=new Map<string,RetainedInputContent>();
 /**
  JSON encodes the complete chunk-identity sequence, avoiding a delimiter relation or digest-only equality.

  @param text - original content is needed only while constructing its shared representation
  
  @param json - only the producer's generated JSON receives string-token chunking
  
  @returns existing exact content or a new detached immutable representation
  */
 function retain({
   text,
   json
 }: {
   readonly text:string;
   readonly json:boolean
 }): RetainedInputContent {
  /**
   Token alignment shares growing JSON strings without changing original bytes.
   */
  const {key,pages}=retainPieces({
    text,
    json
  });
  /**
   Exact sequence reuse preserves distinct source publications outside this store.
   */
  const previous=contents.get(key);
  if(previous!==undefined)return previous;
  /**
   The reader captures detached pieces rather than this temporary serialization.
   */
  const content=retainContentReader({
   pages,
   sha256:createHash('sha256')
     .update(text)
     .digest('hex')
  });
  contents.set(
    key,
    content
  );
  return content;
 }
 return retain;
}

/**
 Publish immutable source fields with a pure content read controlled by the original producer.

 @param fields - original source identity and eligibility fields remain unchanged
 
 @param content - storage representation grants no source or permission authority
 
 @returns frozen source retaining the ordinary string-valued content interface

 @example
 ```ts
 const retain=createInputContentStore();
 const source=freezeInputContentSource({fields:{id:'source'},content:retain({text:'input',json:false})});
 ```
 */
export function freezeInputContentSource<const Fields extends Readonly<Record<string,unknown>>>({
  fields,
  content
}: {
 readonly fields:Fields;
 readonly content:RetainedInputContent
}): Readonly<Fields&{readonly content:string}> {
 /**
  A fresh ordinary object owns its immutable content accessor independently of caller fields.
  */
 const source=Object.freeze({
  ...fields,
  /**
   {@inheritDoc RetainedInputContent.read}
   */
  get content(): string {return content.read();}
 });
 sourceContentDescriptors.set(
   source,
   Object.getOwnPropertyDescriptors(source)
     .content
 );
 return source;
}

/**
 Recognize only an exact producer's frozen source/accessor pair without invoking it.
 This identifies a storage reader, never the source's governing scope or publication authority.

 @param record - caller separately authenticates the original source owner
 
 @param key - only the declared content field has a producer-controlled accessor
 
 @param field - observed descriptor must match that exact original source
 
 @returns whether this accessor belongs to the immutable input content store

 @example
 ```ts
 const matches=isInputContentDescriptor({record:source,key:'content',field:observedDescriptor});
 ```
 */
export function isInputContentDescriptor({
  record,
  key,
  field
}: {
 readonly record:object;
 readonly key:PropertyKey;
 readonly field:Readonly<PropertyDescriptor>
}): boolean {
 /**
  Only a descriptor captured from this producer's original source can match.
  */
 const original=sourceContentDescriptors.get(record);
 return (key==='content')&&(original!==undefined)
   &&(field.get!==undefined)
   &&(field.get===original.get)
   &&(field.set===undefined)
   &&(field.enumerable===true)
   &&(field.configurable===false);
}

//endregion One manager's input ledger shares storage while retaining every original source occurrence
