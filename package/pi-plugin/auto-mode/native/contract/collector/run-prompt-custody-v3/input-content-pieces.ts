/**
 Share bounded pages of detached text chunks across changing input snapshots.

 @module
 */
import {Buffer} from 'node:buffer';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {nonNullishOrThrow} from '@monochromatic-dev/module-or-throw/ts';
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
 Maximum page references bound fallback runs without a content anchor.
 */
const PAGE_CHUNKS=256;

/**
 Minimum page size bounds reference overhead when common tokens repeatedly select anchors.
 */
const MIN_PAGE_CHUNKS=64;
/**
 A bounded preceding window lets page boundaries recover after an earlier insertion.
 */
const WINDOW_CHUNKS=8;
/**
 Prime modulus keeps every rolling product exactly representable as a JavaScript integer.
 */
const WINDOW_MODULUS=65_521;
/**
 Polynomial radix combines preceding chunk identities without storing their complete prefix.
 */
const WINDOW_RADIX=31;
/**
 Removing the oldest window member keeps each update constant-time.
 */
const WINDOW_POWER=WINDOW_RADIX**WINDOW_CHUNKS%WINDOW_MODULUS;
/**
 Boundary diagnostics retain counts without exposing retained input text.
 */
const l=tagged({tag:'auto-mode-native-input-pages'});

/**
 Select bounded pages using preceding content rather than a complete snapshot's starting offset.
 Fingerprints select boundaries only; exact ordinal sequences still determine page identity.

 @param pieces - original chunk identities remain stable when an earlier message is inserted

 @returns bounded page pieces covering every original chunk exactly once
 */
function* inputContentPagePieces(pieces:readonly ContentChunk[]): Generator<readonly ContentChunk[]> {
 /**
  Boundary diagnostics retain the pure partitioning function's identity without chunk contents.
  */
 const pl=tagged({tag:inputContentPagePieces.name,l});
 pl.debug('selecting bounded content-aligned input pages');
 /**
  The rolling window uses constant space and never becomes an equality or authority witness.
  */
 const window=new Uint16Array(WINDOW_CHUNKS);
 /**
  One cursor updates the bounded fingerprint independently of the most recent page cut.
  */
 const cursor={index:0,offset:0,hash:0,start:0};
 for(const piece of pieces){
  /**
   Modulo keeps outgoing products below the exact-integer limit even for later manager ordinals.
   */
  const value=piece.ordinal%WINDOW_MODULUS;
  /**
   A valid ring position always contains its initialized previous ordinal residue.
   */
  const outgoing=nonNullishOrThrow(window[cursor.offset]);
  cursor.hash=(cursor.hash*WINDOW_RADIX+value
   -(outgoing*WINDOW_POWER%WINDOW_MODULUS)+WINDOW_MODULUS)%WINDOW_MODULUS;
  window[cursor.offset]=value;
  cursor.offset=(cursor.offset+1)%WINDOW_CHUNKS;
  cursor.index++;
  /**
   Common anchors cannot create tiny pages, and absent anchors cannot create oversized pages.
   */
  const size=cursor.index-cursor.start;
  if((size>=PAGE_CHUNKS)||((size>=MIN_PAGE_CHUNKS)&&(cursor.hash%PAGE_CHUNKS===0))){
   yield pieces.slice(cursor.start,cursor.index);
   cursor.start=cursor.index;
  }
 }
 if(cursor.start<pieces.length)yield pieces.slice(cursor.start);
 pl.debug('completed content-aligned input page selection');
}

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
  The manager-local interner retains its separate diagnostic function boundary.
  */
 const il=tagged({tag:createInputContentPieces.name,l});
 il.debug('created manager-owned content page interner');
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
  for(const pagePieces of inputContentPagePieces(pieces)){
   sequence.push(internPage(pagePieces));
  }
  return {
   key:JSON.stringify(sequence.map(function pageOrdinal(page){return page.ordinal;})),
   pages:Object.freeze(sequence)
  };
 }
 return retain;
}

//endregion Manager-local page identities share representation without merging source occurrences
