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
 Multiple native views can therefore share one aggregate copier budget, not one budget per tool or view.
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
   ||(length>4_096)
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
 const diagnosticBudget={bytes:0};
 function gap({
   ordinal,
   key,
   reason
 }){
  // Bound diagnostics during selection, before their containing source record is serialized.
  if((unobservedMetadata.length>=4_096)||(Buffer.byteLength(key)>65_536))throw new SourceCollectionError('Tool metadata observation gaps exceed the bounded source profile');
  const entry={
    ordinal,
    key,
    reason
  };diagnosticBudget.bytes+=Buffer.byteLength(JSON.stringify(entry));
  if(diagnosticBudget.bytes>1_048_576)throw new SourceCollectionError('Tool metadata observation gaps exceed the byte bound');
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
  if(keys.length>4_097)throw new SourceCollectionError('Native tool metadata container exceeds the property bound');
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

/** Capture a declaration list using the same ordinary metadata profile and one aggregate copier budget. */
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
