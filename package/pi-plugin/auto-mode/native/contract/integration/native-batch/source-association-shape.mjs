import {types} from 'node:util';

//region Native serializer envelope and ordinary data requirements.
/** Restrict custody copies to ordinary data without serialization hooks. */
export function dataRecord(value){
 return (value!==null)
   &&((typeof value)==='object')
   &&(!types.isProxy(value))
   &&(Object.getPrototypeOf(value)===Object.prototype)
   &&(!('toJSON' in value))
   &&Reflect.ownKeys(value)
   .every(function isEnumerableOwnDataField(key) { return (((typeof key)==='string')
     &&Object.getOwnPropertyDescriptor(
    value,
    key
  )
     .enumerable
     &&Object.hasOwn(
    Object.getOwnPropertyDescriptor(
      value,
      key
    ),
    'value'
  )); });
}
export function denseArray(value){
 return (!types.isProxy(value))
   &&Array.isArray(value)
   &&(Object.getPrototypeOf(value)===Array.prototype)
   &&(!('toJSON' in value))
   &&(Reflect.ownKeys(value)
     .length
     ===(value.length
     +1))
   &&Array.from(
    {length:value.length},
    function readContributionIndexDescriptor(
      _,
      index
    ) { return (Object.getOwnPropertyDescriptor(
      value,
      String(index)
    )); }
  )
   .every(function isOwnDataDescriptor(item) { return (item?.enumerable&&Object.hasOwn(
    item,
    'value'
  )); });
}

/** Shared native envelope restrictions remain independent of any particular source route. */
export function envelopeReason({
  model,
  context,
  options
}){
 if((model.compat
   ?.supportsMidConvoSystemMessages
   ===true)||(model.samplingParams!==undefined)
   ||(model.samplingParamsByThinkingLevel!==undefined)
   ||(options?.samplingParams!==undefined))return 'Transcript or sampling overrides are outside this serializer-association profile';
 if((!dataRecord(context))||(Object.keys(context)
   .length
   !==1)
   ||(!Object.hasOwn(
     context,
     'messages'
   )))return 'Source association requires the native normalized message-only context';
 if((!denseArray(context.messages))||(!context.messages
   .every(dataRecord)))return 'Serializer message envelopes require ordinary data fields for source association';
 return undefined;
}

//endregion
