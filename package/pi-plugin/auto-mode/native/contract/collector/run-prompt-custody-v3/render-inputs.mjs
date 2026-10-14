import {createHash} from 'node:crypto';
import {SourceCollectionError} from '../collector.mjs';

/** Copy a flat native text record without invoking an output accessor. */
function textRecord({
  value,
  fields
}){
 if((!value)||((typeof value)!=='object')
   ||(Object.getPrototypeOf(value)!==Object.prototype))throw new SourceCollectionError('Native prompt construction requires an ordinary text record');
 const keys=Reflect.ownKeys(value);
 if((keys.length>512)||keys.some(function isUnsupportedRenderKey(key) { return (((typeof key)!=='string')||(key==='__proto__')); })
   ||(fields&&((keys.length!==fields.length)||keys.some(function isUnexpectedRenderField(key) { return (!fields.includes(key)); }))))throw new SourceCollectionError('Native prompt construction has unsupported text fields');
 const copied={};
 for(const key of keys){
  const property=Object.getOwnPropertyDescriptor(
    value,
    key
  );
  if((!property?.enumerable)||(!Object.hasOwn(
    property,
    'value'
  ))
    ||((typeof property.value)!=='string'))throw new SourceCollectionError('Native prompt construction requires text data fields');
  copied[key]=property.value;
 }
 return Object.freeze(copied);
}

/** Source construction alone grants no identity; the original run publication owns the result. */
export function captureRenderInputs({
  output,
  runOccurrence,
  renderOccurrence
}){
 if((!output)||((typeof output)!=='object')
   ||(Object.getPrototypeOf(output)!==Object.prototype)
   ||(Reflect.ownKeys(output)
     .length
     !==2))throw new SourceCollectionError('Native prompt builder requires sections and generated fragments');
 const sectionsField=Object.getOwnPropertyDescriptor(
   output,
   'sections'
 ); const generatedField=Object.getOwnPropertyDescriptor(
   output,
   'generated'
 );
 if((!sectionsField)||(!generatedField)
   ||(!Object.hasOwn(
     sectionsField,
     'value'
   ))
   ||(!Object.hasOwn(
     generatedField,
     'value'
   )))throw new SourceCollectionError('Native prompt builder output requires original data fields');
 const sections=textRecord({value:sectionsField.value});
   const generated=generatedField.value;
 if((!Array.isArray(generated))||(Object.getPrototypeOf(generated)!==Array.prototype)
   ||(generated.length>512)
   ||(Reflect.ownKeys(generated)
     .length
     !==(generated.length
     +1)))throw new SourceCollectionError('Native generated fragments require a bounded dense list');
 const inputs=[];
 for(let ordinal=0;ordinal<generated.length;ordinal++){
  const property=Object.getOwnPropertyDescriptor(
    generated,
    String(ordinal)
  );
  if((!property?.enumerable)||(!Object.hasOwn(
    property,
    'value'
  )))throw new SourceCollectionError('Native generated fragment must be an original data entry');
  const hasInsertion=(property.value!==null)&&((typeof property.value)==='object')
    &&Object.hasOwn(
    property.value,
    'nativeRuleInsertion'
  );
  const {
    slot,
    content,
    nativeRuleInsertion
  }=textRecord({
    value:property.value,
    fields:hasInsertion?[
      'slot',
      'content',
      'nativeRuleInsertion'
    ]:[
      'slot',
      'content'
    ]
  });
  if(hasInsertion&&((slot!=='default-rule')||(![
    'inserted',
    'not-inserted'
  ].includes(nativeRuleInsertion))))throw new SourceCollectionError('Native rule insertion requires an observed original rule addition result');
  if(Buffer.byteLength(content)>65_536)throw new SourceCollectionError('Native generated fragment exceeds source text bound');
  inputs.push(Object.freeze({
    kind:'native-generated-prompt-input',
    content,
    ...(hasInsertion?{nativeRuleInsertion}:{}),
    inputLocation:Object.freeze({
      field:'nativePromptBuilder',
      ordinal,
      slot
    }),
    sha256:createHash('sha256')
      .update(content)
      .digest('hex'),
    occurrence:Object.freeze({}),
    runOccurrence,
    renderOccurrence,
    registration:undefined,
    renderedVisibility:'not-established',
    permission:false
  }));
 }
 return Object.freeze({
   sections,
   inputs:Object.freeze(inputs)
 });
}
