import {types} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';
import {copyToolMetadata} from '../run-prompt-custody/messages.mjs';
import {selectToolMetadataInput} from './tool-metadata.mjs';

/** Capture the declaration views actually delivered to one callback, not unprocessed live definitions. */
export function snapshotToolLoadoutInput(input){
 if((!input)||((typeof input)!=='object')
   ||types.isProxy(input)
   ||(Object.getPrototypeOf(input)!==Object.prototype))throw new SourceCollectionError('Native loadout input requires its ordinary argument record');
 const views=[
   'declared',
   'callable',
   'registered'
 ]; const capabilities=[
   'getExposure',
   'getNamespace',
   'getPromptGuidelines'
 ];
 const keys=Reflect.ownKeys(input);
 if((keys.length!==(views.length
   +capabilities.length))||keys.some(key=>((typeof key)!=='string')||((!views.includes(key))&&(!capabilities.includes(key)))))throw new SourceCollectionError('Native loadout argument fields differ from the supported processing profile');
 const fields=Object.getOwnPropertyDescriptors(input);
 for(const key of keys){
  const field=fields[key];
  if((!field?.enumerable)||(!Object.hasOwn(
    field,
    'value'
  )))throw new SourceCollectionError('Native loadout argument requires data properties');
  if(capabilities.includes(key)&&((typeof field.value)!=='function'))throw new SourceCollectionError('Native loadout query slots must remain callable capabilities');
 }
 const selected={};
   const selectedFields=[];
   const unobservedMetadata=[];
 let declarations=0;
 let gapBytes=0;
 for(const key of views){
  const tools=fields[key]
    .value;
  if(types.isProxy(tools)||(!Array.isArray(tools)))throw new SourceCollectionError('Native loadout declaration views require arrays');
  const length=Object.getOwnPropertyDescriptor(
    tools,
    'length'
  )
    ?.value;
  if((!Number.isSafeInteger(length))||(length<0)
    ||((declarations+=length)>4_096))throw new SourceCollectionError('Native loadout views exceed the aggregate declaration bound');
  const selection=selectToolMetadataInput(tools);selected[key]=selection.selected;
  for(const field of selection.metadata
    .selectedFields)selectedFields.push(`${key}.${field}`);
  for(const gap of selection.metadata
    .unobservedMetadata
    ??[]){
   const entry=Object.freeze({
     ...gap,
     key:`${key}.${gap.key}`
   });gapBytes+=Buffer.byteLength(JSON.stringify(entry));
   if((unobservedMetadata.length>=4_096)||(Buffer.byteLength(entry.key)>65_536)
     ||(gapBytes>1_048_576))throw new SourceCollectionError('Native loadout metadata gaps exceed the aggregate diagnostic bound');
   unobservedMetadata.push(entry);
  }
 }
 const value=copyToolMetadata(selected);
 const metadata=Object.freeze({
   method:'prepareLoadout',
   phase:'input',
   selectedFields:Object.freeze(selectedFields),
   ...(unobservedMetadata.length > 0?{unobservedMetadata:Object.freeze(unobservedMetadata)}:{})
 });
 return Object.freeze({
   value,
   metadata
 });
}
