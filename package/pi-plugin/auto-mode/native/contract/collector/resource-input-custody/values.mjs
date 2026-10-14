import {SourceCollectionError} from '../collector.mjs';

/** This finite input profile does not admit accessors, proxies, subclasses or hidden fields. */
function fields({
  value,
  keys,
  label
}){
  if((value===null)||((typeof value)!=='object')
    ||(![
      Object.prototype,
      null
    ].includes(Object.getPrototypeOf(value))))throw new SourceCollectionError(`${label} requires an ordinary record`);
  const actual=Reflect.ownKeys(value);
  if((actual.length!==keys.length)||actual.some(key=>((typeof key)!=='string')||(!keys.includes(key))))throw new SourceCollectionError(`${label} has unsupported fields`);
  for(const key of keys){const property=Object.getOwnPropertyDescriptor(
    value,
    key
  );if((!property?.enumerable)||(!Object.hasOwn(
    property,
    'value'
  )))throw new SourceCollectionError(`${label} requires data fields`);}
}
function text({
  value,
  label
}){
  if(((typeof value)!=='string')||(Buffer.byteLength(value)>65_536))throw new SourceCollectionError(`${label} requires bounded text`);
  return value;
}
function list({
  value,
  label,
  maximum
}){
  if((!Array.isArray(value))||(Object.getPrototypeOf(value)!==Array.prototype)
    ||(value.length>maximum)
    ||(Reflect.ownKeys(value)
      .length
      !==(value.length
      +1)))throw new SourceCollectionError(`${label} requires a bounded ordinary dense array`);
  for(let index=0;index<value.length;index++){const property=Object.getOwnPropertyDescriptor(
    value,
    String(index)
  );if((!property?.enumerable)||(!Object.hasOwn(
    property,
    'value'
  )))throw new SourceCollectionError(`${label} contains a missing or accessor entry`);}
  return value;
}
/** Copy inputs before callbacks and results after callbacks, without retaining borrowed mutable content. */
export function snapshotInput({
  kind,
  value
}){
  let copy;
  if(kind==='context'){
    fields({
      value,
      keys:['agentsFiles'],
      label:'Context input'
    });
    const files=list({
      value:value.agentsFiles,
      label:'Context files',
      maximum:64
    });
    copy=Object.freeze({agentsFiles:Object.freeze(files.map(file=>{
      fields({
        value:file,
        keys:[
          'path',
          'content'
        ],
        label:'Context file'
      });
      return Object.freeze({
        path:text({
          value:file.path,
          label:'Context file path'
        }),
        content:text({
          value:file.content,
          label:'Context file content'
        })
      });
    }))});
  }else if(kind==='system')copy=value===undefined?undefined:text({
    value,
    label:'System input'
  });
  else if(kind==='append')copy=Object.freeze(list({
    value,
    label:'Append input',
    maximum:32
  })
    .map(value=>text({
      value,
      label:'Append text'
    })));
  else throw new SourceCollectionError('Unknown resource input kind');
  if(Buffer.byteLength(JSON.stringify({value:copy}))>524_288)throw new SourceCollectionError('Resource input exceeds total byte bound');
  return copy;
}
/** Constructor options retain opaque native dependencies, but may not invoke accessors while selecting them. */
export function copyOptions(options){
  if((!options)||((typeof options)!=='object')
    ||(![
      Object.prototype,
      null
    ].includes(Object.getPrototypeOf(options))))throw new SourceCollectionError('Loader options require an ordinary record');
  const result={};
  for(const key of Reflect.ownKeys(options)){
    const property=Object.getOwnPropertyDescriptor(
      options,
      key
    );
    if(((typeof key)!=='string')||(!property?.enumerable)
      ||(!Object.hasOwn(
      property,
      'value'
    ))
      ||(key==='__proto__'))throw new SourceCollectionError('Loader options require named data properties');
    result[key]=property.value;
  }
  if(result.appendSystemPrompt!==undefined)result.appendSystemPrompt=snapshotInput({
    kind:'append',
    value:result.appendSystemPrompt
  });
  return result;
}
