//region Bounded source-data patterns describe arguments; the native VM still executes the program.
export class ResultProgramProfileError extends Error {constructor(message){super(`Result-derived program is outside the inspected profile: ${message}`);this.name=this.constructor
  .name;}}
export function requireProfile(
  {condition,message}
){if(!condition)throw new ResultProgramProfileError(message);}
const patterns=new WeakSet();
function owned(value){Object.freeze(value);patterns.add(value);return value;}
/** Decode only finite literal data and the exact earlier const binding. */
export function readPattern({
  node,
  bindingName,
  depth=0
}){
  requireProfile(
    {condition:depth<=8,
message:'argument nesting exceeds profile'}
  );
  if((node?.type==='Identifier')&&(bindingName!==undefined)
    &&(node.name===bindingName))return owned({kind:'result'});
  if(node?.type==='Literal'){
    const {value} = node;requireProfile(
      {condition:(!node.regex)&&(!node.bigint)
        &&((value===null)||((typeof value)==='string')
          ||((typeof value)==='boolean')
          ||(((typeof value)==='number')
          &&Number.isFinite(value)
            &&(!Object.is(
            value,
            -0
          )))),
message:'non-JSON literal'}
    );return owned({
      kind:'literal',
      value
    });
  }
  if((node?.type==='UnaryExpression')&&(node.operator==='-')
    &&(node.argument
      ?.type
      ==='Literal')
    &&((typeof node.argument
      .value)==='number')){const value=-node.argument
        .value;requireProfile(
    {condition:Number.isFinite(value)&&(!Object.is(
      value,
      -0
    )),
message:'non-JSON number'}
  );return owned({
    kind:'literal',
    value
  });}
  if(node?.type==='ArrayExpression'){requireProfile(
    {condition:node.elements
      .length
      <=64,
message:'array size bound'}
  );const items=node.elements
    .map(function readArrayPattern(item) {requireProfile(
      {condition:(item!==null)&&(item.type!=='SpreadElement'),
message:'array hole or spread'}
    );return readPattern({
      node:item,
      bindingName,
      depth:depth+1
    });});return owned({
    kind:'array',
    items:Object.freeze(items)
  });}
  requireProfile(
    {condition:(node?.type==='ObjectExpression')&&(node.properties
      .length
      <=64),
message:'literal object or earlier result reference required'}
  );const keys=new Set();
  const entries=[];
  for(const property of node.properties){
    requireProfile(
      {condition:(property.type==='Property')&&(!property.computed)
        &&(!property.method)
        &&(property.kind==='init'),
message:'ordinary data property required'}
    );
    const key=property.key
      .type
      ==='Identifier'?property.key
        .name:(property.key
          .type
          ==='Literal')&&((typeof property.key
            .value)==='string')?property.key
              .value:undefined;
    requireProfile(
      {condition:((typeof key)==='string')&&(key!=='__proto__')
        &&(!keys.has(key)),
message:'duplicate, prototype-setting or unsupported key'}
    );keys.add(key);
    // Shorthand is allowed only for the exact earlier result binding.
    requireProfile(
      {condition:(!property.shorthand)||((bindingName!==undefined)
        &&(property.value
          .type
          ==='Identifier')
        &&(property.value
          .name
          ===bindingName)),
message:'unbound shorthand'}
    );
    entries.push(Object.freeze({
      key,
      pattern:readPattern({
        node:property.value,
        bindingName,
        depth:depth+1
      })
    }));
  }
  return owned({
    kind:'object',
    entries:Object.freeze(entries)
  });
}
/** Compute expected argument data from a separately owned string result, never executable source. */
export function materializePattern({
  pattern,
  result
}){
  requireProfile(
    {condition:patterns.has(pattern),
message:'pattern was not created by this source decoder'}
  );
  if(pattern.kind==='literal')return pattern.value;
  if(pattern.kind==='result'){
    requireProfile(
      {condition:((typeof result)==='string')&&(Buffer.byteLength(result)<=65_536),
message:'owned string result required'}
    );return result;
  }
  if(pattern.kind==='array')return Object.freeze(pattern.items
      .map(function materializeArrayItem(item) { return (materializePattern({
        pattern:item,
        result
      })); }));
  if(pattern.kind==='object')return Object.freeze(
      Object.fromEntries(pattern.entries
        .map(function materializeObjectEntry(entry) { return ([
          entry.key,
          materializePattern({
            pattern:entry.pattern,
            result
          })
        ]); })),
    );
  throw new ResultProgramProfileError('unknown owned pattern kind');
}
//endregion
