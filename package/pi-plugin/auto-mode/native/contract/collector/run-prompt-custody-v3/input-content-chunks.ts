/**
 Divide producer-serialized input without retaining a complete growing JSON string.

 @module
 */

//region String-token boundaries make shared content independent of surrounding JSON offsets

/** Bound the changing tail of each retained string token. */
const CHUNK_CODE_UNITS=4096;

/**
 Split already-serialized JSON at string-token boundaries and bounded intervals.
 The producer supplies JSON.stringify output, so this scanner does not validate arbitrary JSON.
 Escaped quotes remain inside their original token and every code unit remains unchanged.

 @param text - original immutable serialization or plain text
 @param json - producer's serialization format determines whether quotes have structural meaning
 @returns ordered slices for the content store to detach and intern
 */
export function inputContentChunks({text,json}: {readonly text:string;readonly json:boolean}): readonly string[] {
 const chunks:string[]=[];
 const cursor={index:0,start:0,string:false};
 while(cursor.index<text.length){
  const character=text[cursor.index];
  if(json&&character==='"'){
   if(cursor.string){
    cursor.index++;
    chunks.push(text.slice(cursor.start,cursor.index));
    cursor.start=cursor.index;
    cursor.string=false;
    continue;
   }
   if(cursor.start<cursor.index)chunks.push(text.slice(cursor.start,cursor.index));
   cursor.start=cursor.index;
   cursor.string=true;
   cursor.index++;
   continue;
  }
  if(cursor.index-cursor.start>=CHUNK_CODE_UNITS){
   chunks.push(text.slice(cursor.start,cursor.index));
   cursor.start=cursor.index;
  }
  cursor.index+=json&&cursor.string&&character==='\\'?2:1;
 }
 if(cursor.start<text.length)chunks.push(text.slice(cursor.start));
 return Object.freeze(chunks);
}

//endregion String-token boundaries make shared content independent of surrounding JSON offsets
