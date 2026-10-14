import {SourceCollectionError} from '../collector.mjs';

/** Copy the declared SDK prompt-option schema without freezing borrowed skill/source records. */
export function copyPromptOptions(input){
  let bytes=0;
  function record({value,required,optional=[]}){
    if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw new SourceCollectionError('Prompt input requires an ordinary record');
    const keys=Reflect.ownKeys(value);
    if(keys.some(key=>typeof key!=='string'||!required.includes(key)&&!optional.includes(key))||required.some(key=>!Object.hasOwn(value,key)))throw new SourceCollectionError('Prompt input has missing or unsupported fields');
    for(const key of keys){const item=Object.getOwnPropertyDescriptor(value,key);if(!item?.enumerable||!Object.hasOwn(item,'value'))throw new SourceCollectionError('Prompt input requires data properties');}
    return value;
  }
  function text(value){
    if(typeof value!=='string'||Buffer.byteLength(value)>65536)throw new SourceCollectionError('Prompt input text exceeds its declared profile');
    bytes+=Buffer.byteLength(JSON.stringify(value));if(bytes>1048576)throw new SourceCollectionError('Prompt option text exceeds total byte bound');return value;
  }
  function optionalText(value){return value===undefined?undefined:text(value);}
  function array({value,maximum,copy}){
    if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>maximum||Reflect.ownKeys(value).length!==value.length+1)throw new SourceCollectionError('Prompt input requires a bounded dense array');
    const result=[];for(let index=0;index<value.length;index++){const item=Object.getOwnPropertyDescriptor(value,String(index));if(!item?.enumerable||!Object.hasOwn(item,'value'))throw new SourceCollectionError('Prompt array has a missing or accessor entry');result.push(copy(item.value));}return result;
  }
  function texts(value){return array({value,maximum:512,copy:text});}
  function mapping({value,copy}){
    if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length>512)throw new SourceCollectionError('Prompt map requires a bounded ordinary record');
    const result={};for(const key of Reflect.ownKeys(value)){const item=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||key==='__proto__'||!item?.enumerable||!Object.hasOwn(item,'value'))throw new SourceCollectionError('Prompt map requires named data properties');text(key);result[key]=copy(item.value);}return result;
  }
  function file(value){record({value,required:['path','content']});return {path:text(value.path),content:text(value.content)};}
  function skill(value){
    record({value,required:['name','description','filePath','baseDir','sourceInfo','disableModelInvocation']});
    const source=record({value:value.sourceInfo,required:['path','source','scope','origin'],optional:['baseDir']});
    if(typeof value.disableModelInvocation!=='boolean'||!['user','project','temporary'].includes(source.scope)||!['package','top-level'].includes(source.origin))throw new SourceCollectionError('Skill metadata differs from the declared prompt schema');
    return {name:text(value.name),description:text(value.description),filePath:text(value.filePath),baseDir:text(value.baseDir),sourceInfo:{path:text(source.path),source:text(source.source),scope:source.scope,origin:source.origin,baseDir:optionalText(source.baseDir)},disableModelInvocation:value.disableModelInvocation};
  }
  record({value:input,required:['customPrompt','forceSystemPrompt','selectedTools','toolSnippets','toolGuidelines','promptGuidelines','appendSystemPrompt','sections','cwd','contextFiles','skills'],optional:['hiddenTools']});
  const result={customPrompt:optionalText(input.customPrompt),forceSystemPrompt:optionalText(input.forceSystemPrompt),selectedTools:texts(input.selectedTools),...(input.hiddenTools===undefined?{}:{hiddenTools:texts(input.hiddenTools)}),toolSnippets:mapping({value:input.toolSnippets,copy:text}),toolGuidelines:mapping({value:input.toolGuidelines,copy:texts}),promptGuidelines:texts(input.promptGuidelines),appendSystemPrompt:text(input.appendSystemPrompt),sections:mapping({value:input.sections,copy:text}),cwd:text(input.cwd),contextFiles:array({value:input.contextFiles,maximum:64,copy:file}),skills:array({value:input.skills,maximum:128,copy:skill})};
  if(Buffer.byteLength(JSON.stringify(result))>1048576)throw new SourceCollectionError('Complete prompt option snapshot exceeds total byte bound');return result;
}
/** Freeze only owned copies; mutable run copies retain the SDK's documented handler contract. */
export function freezePromptOptions(input){
  const copy=copyPromptOptions(input),pending=[copy];
  while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;pending.push(...Object.values(value));Object.freeze(value);}
  return copy;
}
