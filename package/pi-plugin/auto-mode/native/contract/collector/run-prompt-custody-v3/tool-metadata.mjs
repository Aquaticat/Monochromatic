import {types} from 'node:util';
import {SourceCollectionError} from '../collector.mjs';
import {copyToolMetadata} from '../run-prompt-custody/messages.mjs';

//region The SDK declaration's data fields are input material, not instruction authority.
/** Data slots in the installed ToolDefinition contract; absent values contain no received prose. */
const dataFields=new Set([
  'name',
  'description',
  'label',
  'promptSnippet',
  'promptGuidelines',
  'parameters',
  'constrainedSampling',
  'renderShell',
  'outputSchema',
  'exposure',
  'namespace',
  'annotations',
  'defaultActive',
  'executionMode'
]);
/** Executable hooks are capabilities; their returned input material needs its own native receipt. */
const callableFields=new Set([
  'prepareArguments',
  'prepareLoadout',
  'reachesTools',
  'execute',
  'renderCall',
  'renderResult'
]);

/** Require the same ordinary descriptor profile as the original name/description observation. */
function requiredText({
  tool,
  key
}){
 const field=Object.getOwnPropertyDescriptor(
   tool,
   key
 );
 if((!field?.enumerable)||(!Object.hasOwn(
   field,
   'value'
 ))
   ||((typeof field.value)!=='string'))throw new SourceCollectionError('Native custom tool names and descriptions require original text');
 return field.value;
}

/**
 Select declaration fields without getters; selected schema leaves remain borrowed until the caller copies them.
 Multiple native views share the same descriptor and cycle validation.
 */
export function selectToolMetadataInput(tools){
 if(types.isProxy(tools)||(!Array.isArray(tools)))throw new SourceCollectionError('Native custom tool descriptions require their original array');
 const length=Object.getOwnPropertyDescriptor(
   tools,
   'length'
 )
   ?.value;
 if((Object.getPrototypeOf(tools)!==Array.prototype)||(!Number.isSafeInteger(length))
   ||(length<0)
   ||(Reflect.ownKeys(tools)
     .length
     !==(length
     +1)))throw new SourceCollectionError('Native custom tool descriptions require a bounded dense array');
 const selected=[];
   const selectedFields=new Set([
   'name',
   'description'
 ]);
   const unobservedMetadata=[];
 function gap({
   ordinal,
   key,
   reason
 }){
  // Preserve every observation gap in the containing source record.
  const entry={
    ordinal,
    key,
    reason
  };
  unobservedMetadata.push(Object.freeze(entry));
 }
 for(let ordinal=0;ordinal<length;ordinal++){
  const field=Object.getOwnPropertyDescriptor(
    tools,
    String(ordinal)
  );
  if((!field?.enumerable)||(!Object.hasOwn(
    field,
    'value'
  )))throw new SourceCollectionError('Native custom tool descriptions require data entries');
  const tool=field.value;
  if((!tool)||((typeof tool)!=='object')
    ||types.isProxy(tool)
    ||(Object.getPrototypeOf(tool)!==Object.prototype))throw new SourceCollectionError('Native tool metadata requires an ordinary non-proxy declaration');
  const name=requiredText({
    tool,
    key:'name'
  }); const description=requiredText({
    tool,
    key:'description'
  });
  const pairs=[
    [
      'name',
      name
    ],
    [
      'description',
      description
    ]
  ]; const keys=Reflect.ownKeys(tool);
  for(const key of keys){
   if((key==='name')||(key==='description')
     ||callableFields.has(key))continue;
   if((typeof key)!=='string'){gap({
     ordinal,
     key:String(key),
     reason:'symbol'
   });continue;}
   const descriptor=Object.getOwnPropertyDescriptor(
     tool,
     key
   );
   if((!descriptor)||(!Object.hasOwn(
     descriptor,
     'value'
   ))){gap({
     ordinal,
     key,
     reason:'accessor'
   });continue;}
   if(!descriptor.enumerable){gap({
     ordinal,
     key,
     reason:'non-enumerable'
   });continue;}
   if(!dataFields.has(key)){gap({
     ordinal,
     key,
     reason:'unsupported-field'
   });continue;}
   pairs.push([
     key,
     descriptor.value
   ]);selectedFields.add(key);
  }
  selected.push(Object.fromEntries(pairs));
 }
 const metadata=Object.freeze({
   method:'constructor',
   selectedFields:Object.freeze([...selectedFields]),
   ...(unobservedMetadata.length > 0?{unobservedMetadata:Object.freeze(unobservedMetadata)}:{})
 });
 return Object.freeze({
   selected,
   metadata
 });
}

/** Capture a declaration list using the same ordinary metadata profile without arbitrary capture ceilings. */
export function snapshotToolMetadata(tools){
 const {
   selected,
   metadata
 }=selectToolMetadataInput(tools);
 return Object.freeze({
   value:copyToolMetadata(selected),
   metadata
 });
}
//endregion
