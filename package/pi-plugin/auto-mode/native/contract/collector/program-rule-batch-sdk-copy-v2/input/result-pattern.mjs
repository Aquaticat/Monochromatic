import { readOwnedPattern } from './pattern-decoder.ts';
//region Bounded source-data patterns describe arguments; the native VM still executes the program.
export class ResultProgramProfileError extends Error {constructor(message){super(`Result-derived program is outside the inspected profile: ${message}`);this.name=this.constructor
  .name;}}
export function requireProfile(
  {condition,message}
){if(!condition)throw new ResultProgramProfileError(message);}
const patterns=new WeakSet();
function owned(value){Object.freeze(value);patterns.add(value);return value;}
/** {@inheritDoc readOwnedPattern} */
export function readPattern({node,bindingName,depth=0}){
  return readOwnedPattern({node,bindingName,depth,owned,ResultProgramProfileError});
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
