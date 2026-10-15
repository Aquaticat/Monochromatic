import {isDeepStrictEqual} from 'node:util';
import {field,dense,textPart,flags} from './message-publication-shape.mjs';

//region Capture and compare descriptor identities of the original text projection.
export function createMessageSignature(input){
 const raw=input.content??[];
 const partCount=(typeof raw)==='string'?1:raw.length;
 function textAt(index){return (typeof raw)==='string'?raw:raw[index]
   .text;}
 function validContent({
   value,
   kind
 }){
  if((kind==='custom')||(kind==='entry')){
   if((typeof raw)==='string')return value===raw;
   return dense(value)&&(value.length===partCount)
     &&value.every(function matchesOriginalTextPart(
       part,
       index
     ) { return (textPart(part)&&(part.text===textAt(index))); });
  }
  if((!dense(value))||(!value.every(textPart)))return false;
  if(kind==='llm')return (value.length===partCount)&&value.every(function matchesPublishedText(
    part,
    index
  ) { return (part.text===textAt(index)); });
  if(kind==='payload'){
   let ordinal=0;
   for(let index=0;index<partCount;index++){
    const text=textAt(index);if(text.length===0)continue;
    if((!text.isWellFormed())||(value[ordinal]
      ?.text
      !==text))return false;
    ordinal++;
   }
   return (ordinal>0)&&(ordinal===value.length);
  }
  return false;
 }
 function signature({
   value,
   kind,
   ordinal
 }){
  if(kind==='part'){
   if((!textPart(value))||(value.text!==textAt(ordinal)))return undefined;
   return Object.freeze({
     type:flags(field({value:value,key:'type'})),
     text:flags(field({value:value,key:'text'}))
   });
  }
  const label=field({value:value,key:kind==='entry'?'type':'role'}); const content=field({value:value,key:'content'});
  const expected=kind==='entry'?'custom_message':kind==='custom'?'custom':'user';
  if((!label)||(label.value!==expected)
    ||(!content)
    ||(!validContent({
      value:content.value,
      kind
    })))return undefined;
  const parts=Array.isArray(content.value)?Object.freeze(content.value
    .map(function captureTextPartDescriptors(
      part,
      index
    ) { return (Object.freeze({
      part,
      index:flags(Object.getOwnPropertyDescriptor(
        content.value,
        String(index)
      )),
      type:flags(field({value:part,key:'type'})),
      text:flags(field({value:part,key:'text'}))
    })); })):undefined;
  return Object.freeze({
    label:flags(label),
    content:flags(content),
    contentValue:content.value,
    parts,
    length:parts?flags(Object.getOwnPropertyDescriptor(
      content.value,
      'length'
    )):undefined
  });
 }
 return {partCount,signature};
}

export function sameSignature({
   actual,
   expected
 }){
  if((actual.contentValue!==expected.contentValue)||(!isDeepStrictEqual(
    actual.label,
    expected.label
  ))
    ||(!isDeepStrictEqual(
      actual.content,
      expected.content
    ))
    ||(!isDeepStrictEqual(
      actual.type,
      expected.type
    ))
    ||(!isDeepStrictEqual(
      actual.text,
      expected.text
    ))
    ||(!isDeepStrictEqual(
      actual.length,
      expected.length
    )))return false;
  if((!actual.parts)||(!expected.parts))return actual.parts===expected.parts;
  return (actual.parts
    .length
    ===expected.parts
    .length)
    &&actual.parts
    .every(function matchesCapturedPart(
    part,
    index
  ) {
   const original=expected.parts[index];
   return (part.part===original.part)&&isDeepStrictEqual(
     part.index,
     original.index
   )
     &&isDeepStrictEqual(
     part.type,
     original.type
   )
     &&isDeepStrictEqual(
     part.text,
     original.text
   );
  });
 }
//endregion
