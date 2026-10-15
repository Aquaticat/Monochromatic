import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';

/** Original guideline records remain private drafts until their synchronous rendering is sealed. */
export function createGuidelineInputs({
  options,
  runOccurrence,
  renderOccurrence
}){
 const prompt=options.promptGuidelines
   .map(function capturePromptGuideline(
     content,
     ordinal
   ) { return (({
     kind:'native-run-prompt-guideline-input',
     content,
     ordinal,
     sha256:createHash('sha256')
       .update(content)
       .digest('hex'),
     occurrence:Object.freeze({}),
     runOccurrence,
     renderOccurrence,
     registration:undefined,
     permission:false
   })); });
 const byTool=new Map();
 const tools=Object.entries(options.toolGuidelines)
   .flatMap(function captureToolGuidelineGroup([toolName,entries]) {
  const sources=entries.map(function captureToolGuideline(
    content,
    ordinal
  ) { return (({
    kind:'native-run-tool-guideline-input',
    content,
    inputLocation:Object.freeze({
      field:'toolGuidelines',
      toolName,
      ordinal
    }),
    sha256:createHash('sha256')
      .update(content)
      .digest('hex'),
    occurrence:Object.freeze({}),
    runOccurrence,
    renderOccurrence,
    registration:undefined,
    permission:false
  })); });
  byTool.set(
    toolName,
    sources
  );return sources;
 });
 const publication={sealed:false};
 function observe(value){
  if(publication.sealed)throw new SourceCollectionError('Guideline insertion observation is already sealed');
  if((!value)||((typeof value)!=='object')
    ||types.isProxy(value)
    ||(Object.getPrototypeOf(value)!==Object.prototype))throw new SourceCollectionError('Guideline insertion requires an ordinary native observation');
  const fields=Object.getOwnPropertyDescriptors(value);
  const keys=Reflect.ownKeys(fields);
  if(keys.some(function isUnsupportedDescriptor(key) { return (((typeof key)!=='string')||(!fields[key]
    .enumerable)
    ||(!Object.hasOwn(
    fields[key],
    'value'
  ))); }))throw new SourceCollectionError('Guideline insertion requires native data fields');
  const field=fields.field
    ?.value;
    const ordinal=fields.ordinal
      ?.value; const content=fields.content
        ?.value; const insertion=fields.nativeRuleInsertion
          ?.value;
  const expected=field==='promptGuidelines'?[
    'field',
    'ordinal',
    'content',
    'nativeRuleInsertion'
  ]:field==='toolGuidelines'?[
    'field',
    'toolName',
    'ordinal',
    'content',
    'nativeRuleInsertion'
  ]:[];
  if((expected.length === 0)||(keys.length!==expected.length)
    ||keys.some(function isUnexpectedOptionField(key) { return (!expected.includes(key)); })
    ||(!Number.isSafeInteger(ordinal))
    ||(ordinal<0)
    ||((typeof content)!=='string')
    ||(![
      'inserted',
      'not-inserted'
    ].includes(insertion)))throw new SourceCollectionError('Guideline insertion differs from its native input-location profile');
  if((field==='toolGuidelines')&&((typeof fields.toolName
    .value)!=='string'))throw new SourceCollectionError('Tool guideline insertion requires its original tool name');
  const source=field==='promptGuidelines'?prompt[ordinal]:byTool.get(fields.toolName
    .value)?.[ordinal];
  if((!source)||(source.content!==content))throw new SourceCollectionError('Guideline insertion differs from its original render input');
  // Repeated use of one original entry cannot erase a successful insertion; equal independent entries stay separate.
  if(source.nativeRuleInsertion!=='inserted')source.nativeRuleInsertion=insertion;
 }
 function seal(){
  if(publication.sealed)throw new SourceCollectionError('Guideline source publication is already sealed');
  publication.sealed=true;
  for(const source of prompt)Object.freeze(source);
  for(const source of tools)Object.freeze(source);
  return Object.freeze({
    promptGuidelineInputs:Object.freeze(prompt),
    toolGuidelineInputs:Object.freeze(tools)
  });
 }
 return Object.freeze({
   observe,
   seal
 });
}
