/**
 Retain exact native input text through shared immutable chunks and producer-owned reads.

 @module
 */
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {inputContentChunks} from './input-content-chunks.ts';

//region One manager's input ledger shares storage while retaining every original source occurrence

/** Content identity does not issue input or permission authority. */
export interface RetainedInputContent {
 readonly sha256:string;
 readonly read:()=>string;
}

/** Interned chunks own their text instead of slicing a larger serialized input. */
interface ContentChunk {
 readonly ordinal:number;
 readonly text:string;
}

/** Only exact producer-created source/getter pairs qualify for the immutable-content accessor. */
const sourceContentDescriptors=new WeakMap<object,PropertyDescriptor|undefined>();

/** Storage diagnostics do not include retained text. */
const l=tagged({tag:'auto-mode-native-input-content'});

/**
 Keep the read closure separate from the caller's complete temporary serialization.

 @param chunks - detached immutable text pieces preserve the exact UTF-16 sequence
 @param sha256 - original UTF-8 digest retains the existing source contract
 @returns content reader without a retained flat serialization
 */
function retainContentReader({chunks,sha256}: {readonly chunks:readonly string[];readonly sha256:string}): RetainedInputContent {
 /** Pure reads remain transparent to freshness scans and invoke no input callbacks. */
 function read(): string {return chunks.length===1?chunks[0]??'':chunks.join('');}
 return Object.freeze({sha256,read});
}

/**
 Share content within one manager without merging publications or original occurrences.

 @returns content interner whose private maps have the owning pool's lifetime
 */
export function createInputContentStore(): (input:{readonly text:string;readonly json:boolean})=>RetainedInputContent {
 const sl=tagged({tag:createInputContentStore.name,l});
 sl.debug('created manager-owned immutable input content store');
 const chunks=new Map<string,ContentChunk>();
 const contents=new Map<string,RetainedInputContent>();
 const state={next:0};
 /**
  UTF-16 copying detaches substrings without replacing unpaired surrogate code units.

  @param text - temporary slice must not retain its larger parent serialization
  @returns manager-owned immutable chunk identity
  */
 function internChunk(text:string): ContentChunk {
  const previous=chunks.get(text);
  if(previous!==undefined)return previous;
  const owned=Buffer.from(text,'utf16le').toString('utf16le');
  const chunk=Object.freeze({ordinal:state.next,text:owned});
  state.next++;
  chunks.set(owned,chunk);
  return chunk;
 }
 /**
  JSON encodes the complete chunk-identity sequence, avoiding a delimiter relation or digest-only equality.

  @param text - original content is needed only while constructing its shared representation
  @param json - only the producer's generated JSON receives string-token chunking
  @returns existing exact content or a new detached immutable representation
  */
 function retain({text,json}: {readonly text:string;readonly json:boolean}): RetainedInputContent {
  const pieces=inputContentChunks({text,json}).map(internChunk);
  const key=JSON.stringify(pieces.map(function ordinal(chunk){return chunk.ordinal;}));
  const previous=contents.get(key);
  if(previous!==undefined)return previous;
  const content=retainContentReader({
   chunks:Object.freeze(pieces.map(function ownedText(chunk){return chunk.text;})),
   sha256:createHash('sha256').update(text).digest('hex')
  });
  contents.set(key,content);
  return content;
 }
 return retain;
}

/**
 Publish immutable source fields with a pure content read controlled by the original producer.

 @param fields - original source identity and eligibility fields remain unchanged
 @param content - storage representation grants no source or permission authority
 @returns frozen source retaining the ordinary string-valued content interface
 */
export function freezeInputContentSource<const Fields extends Readonly<Record<string,unknown>>>({fields,content}: {
 readonly fields:Fields;
 readonly content:RetainedInputContent
}): Readonly<Fields&{readonly content:string}> {
 const source=Object.freeze({
  ...fields,
  /** {@inheritDoc RetainedInputContent.read} */
  get content(): string {return content.read();}
 });
 sourceContentDescriptors.set(source,Object.getOwnPropertyDescriptor(source,'content'));
 return source;
}

/**
 Recognize only an exact producer's frozen source/accessor pair without invoking it.
 This identifies a storage reader, never the source's governing scope or publication authority.

 @param record - caller separately authenticates the original source owner
 @param key - only the declared content field has a producer-controlled accessor
 @param field - observed descriptor must match that exact original source
 @returns whether this accessor belongs to the immutable input content store
 */
export function isInputContentDescriptor({record,key,field}: {
 readonly record:object;
 readonly key:PropertyKey;
 readonly field:Readonly<PropertyDescriptor>
}): boolean {
 const original=sourceContentDescriptors.get(record);
 return key==='content'&&original!==undefined&&field.get!==undefined&&field.get===original.get
  &&field.set===undefined&&field.enumerable===true&&field.configurable===false;
}

//endregion One manager's input ledger shares storage while retaining every original source occurrence
