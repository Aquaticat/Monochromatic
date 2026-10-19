/**
 Share bounded pages of detached text chunks across changing input snapshots.

 @module
 */
import {Buffer} from 'node:buffer';
import {inputContentChunks} from './input-content-chunks.ts';

//region Manager-local page identities share representation without merging source occurrences

/**
 Chunk identity preserves exact code-unit equality independently of hashing.
 */
type ContentChunk = {
 readonly ordinal:number;
 readonly text:string;
};

/**
 Bounded immutable page shares its chunk references across complete input versions.
 */
export type ContentPage = {
 readonly ordinal:number;
 readonly texts:readonly string[];
};

/**
 Pages bound reference duplication when a growing snapshot reuses most chunks.
 */
const PAGE_CHUNKS=256;

/**
 Intern text and bounded pages for one owning input pool.

 @returns complete immutable page sequences with exact structural identity keys

 @example
 ```ts
 const retain=createInputContentPieces();
 const pieces=retain({text:'original input',json:false});
 ```
 */
export function createInputContentPieces(): (input:{
 readonly text:string;
 readonly json:boolean;
})=>{
  readonly key:string;
  readonly pages:readonly ContentPage[]
} {
 /**
  Detached text has one identity within this owning manager.
  */
 const chunks=new Map<string,ContentChunk>();
 /**
  Exact chunk-ordinal sequences identify shared bounded pages.
  */
 const pages=new Map<string,ContentPage>();
 /**
  Copy UTF-16 text without retaining the temporary serialization's backing storage.

  @param text - temporary slice preserves even unpaired surrogate code units

  @returns canonical detached chunk for this manager
  */
 function internChunk(text:string): ContentChunk {
  /**
   Exact text equality reuses the original detached chunk.
   */
  const previous=chunks.get(text);
  if(previous!==undefined)return previous;
  /**
   Explicit UTF-16 copying preserves code units independently of substring storage.
   */
  const owned=Buffer.from(
    text,
    'utf16le'
  )
    .toString('utf16le');
  /**
   Immutable ordinal belongs only to this content store.
   */
  const chunk=Object.freeze({
    ordinal:chunks.size,
    text:owned
  });
  chunks.set(
    owned,
    chunk
  );
  return chunk;
 }
 /**
  Intern one bounded ordered sequence without digest-only equality.

  @param pieces - detached chunks for one page

  @returns existing exact page or its immutable representation
  */
 function internPage(pieces:readonly ContentChunk[]): ContentPage {
  /**
   JSON preserves the complete ordered identity sequence without delimiter ambiguity.
   */
  const key=JSON.stringify(pieces.map(function chunkOrdinal(chunk){
   return chunk.ordinal;
  }));
  /**
   Equal pages share both text and their reference array.
   */
  const previous=pages.get(key);
  if(previous!==undefined)return previous;
  /**
   Only a bounded page retains chunk references, never the complete temporary sequence.
   */
  const page=Object.freeze({
   ordinal:pages.size,
   texts:Object.freeze(pieces.map(function chunkText(chunk){return chunk.text;}))
  });
  pages.set(
    key,
    page
  );
  return page;
 }
 /**
  Partition one exact serialization into manager-owned shared pages.

  @param text - original serialization is temporary

  @param json - producer format controls existing string-token alignment

  @returns canonical page sequence and exact content identity key
  */
 function retain({
   text,
   json
 }:{
   readonly text:string;
   readonly json:boolean
 }): {
  readonly key:string;
  readonly pages:readonly ContentPage[];
 } {
  /**
   Full temporary chunk sequence is released after page construction.
   */
  const pieces=inputContentChunks({
    text,
    json
  })
    .map(internChunk);
  /**
   Complete snapshots retain page references instead of every chunk reference.
   */
  const sequence:ContentPage[]=[];
  for(let offset=0;offset<pieces.length;offset+=PAGE_CHUNKS){
   sequence.push(
     internPage(pieces.slice(
       offset,
       offset+PAGE_CHUNKS
     )),
   );
  }
  return {
   key:JSON.stringify(sequence.map(function pageOrdinal(page){return page.ordinal;})),
   pages:Object.freeze(sequence)
  };
 }
 return retain;
}

//endregion Manager-local page identities share representation without merging source occurrences
