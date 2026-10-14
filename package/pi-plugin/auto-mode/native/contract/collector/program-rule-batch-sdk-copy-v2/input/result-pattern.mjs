//region Bounded source-data patterns describe arguments; the native VM still executes the program.
export class ResultProgramProfileError extends Error {constructor(message){super('Result-derived program is outside the inspected profile: '+message);this.name=this.constructor.name;}}
export function requireProfile(condition,message){if(!condition)throw new ResultProgramProfileError(message);}
const patterns=new WeakSet();
function owned(value){Object.freeze(value);patterns.add(value);return value;}
/** Decode only finite literal data and the exact earlier const binding. */
export function readPattern({node,bindingName,depth=0}){
  requireProfile(depth<=8,'argument nesting exceeds profile');
  if(node?.type==='Identifier'&&bindingName!==undefined&&node.name===bindingName)return owned({kind:'result'});
  if(node?.type==='Literal'){
    const value=node.value;requireProfile(!node.regex&&!node.bigint&&(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0)),'non-JSON literal');return owned({kind:'literal',value});
  }
  if(node?.type==='UnaryExpression'&&node.operator==='-'&&node.argument?.type==='Literal'&&typeof node.argument.value==='number'){const value=-node.argument.value;requireProfile(Number.isFinite(value)&&!Object.is(value,-0),'non-JSON number');return owned({kind:'literal',value});}
  if(node?.type==='ArrayExpression'){requireProfile(node.elements.length<=64,'array size bound');const items=node.elements.map(item=>{requireProfile(item!==null&&item.type!=='SpreadElement','array hole or spread');return readPattern({node:item,bindingName,depth:depth+1});});return owned({kind:'array',items:Object.freeze(items)});}
  requireProfile(node?.type==='ObjectExpression'&&node.properties.length<=64,'literal object or earlier result reference required');const keys=new Set(),entries=[];
  for(const property of node.properties){
    requireProfile(property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init','ordinary data property required');
    const key=property.key.type==='Identifier'?property.key.name:property.key.type==='Literal'&&typeof property.key.value==='string'?property.key.value:undefined;
    requireProfile(typeof key==='string'&&key!=='__proto__'&&!keys.has(key),'duplicate, prototype-setting or unsupported key');keys.add(key);
    // Shorthand is allowed only for the exact earlier result binding.
    requireProfile(!property.shorthand||bindingName!==undefined&&property.value.type==='Identifier'&&property.value.name===bindingName,'unbound shorthand');
    entries.push(Object.freeze({key,pattern:readPattern({node:property.value,bindingName,depth:depth+1})}));
  }
  return owned({kind:'object',entries:Object.freeze(entries)});
}
/** Compute expected argument data from a separately owned string result, never executable source. */
export function materializePattern({pattern,result}){
  requireProfile(patterns.has(pattern),'pattern was not created by this source decoder');
  switch(pattern.kind){
    case 'literal':return pattern.value;
    case 'result':requireProfile(typeof result==='string'&&Buffer.byteLength(result)<=65536,'owned string result required');return result;
    case 'array':return Object.freeze(pattern.items.map(item=>materializePattern({pattern:item,result})));
    case 'object':return Object.freeze(Object.fromEntries(pattern.entries.map(entry=>[entry.key,materializePattern({pattern:entry.pattern,result})])));
    default:throw new ResultProgramProfileError('unknown owned pattern kind');
  }
}
//endregion
