import {createGoverningRuleBindings,GoverningRuleBindingError} from './bindings.mjs';

/** Compose existing per-source indexes without merging equal text or repeated codes. */
export function createGoverningRuleSet({readSources,parse}){
 const sources=readSources();
 if(!Array.isArray(sources)||!Object.isFrozen(sources)||sources.length===0||sources.length>64)throw new GoverningRuleBindingError('Original governing sources require a bounded immutable source list');
 if(new Set(sources.map(source=>source.occurrence)).size!==sources.length)throw new GoverningRuleBindingError('Original governing source occurrence is repeated');
 let retired=false,failure;
 function current(){
  if(retired)throw new GoverningRuleBindingError('Original governing source set lost eligibility',{cause:failure});
  try{if(readSources()!==sources)throw new GoverningRuleBindingError('Original governing source list changed');}
  catch(error){retired=true;failure=error;throw error;}
 }
 const records=new WeakMap(),byCode=new Map(),handles=[],instructionHandles=[],headingHandles=[],indexes=[];
 for(const [sourceOrdinal,source] of sources.entries()){
  const index=createGoverningRuleBindings({parse,readSource(){current();return source;}});
  indexes.push(index);
  for(const handle of index.indexedInstructionCandidates()){
   const original=index.read(handle);
   const projection=Object.freeze({...original,sourceOrdinal});
   records.set(handle,{index,original,projection});instructionHandles.push(handle);
   if(projection.code!==undefined){
    handles.push(handle);
    const matches=byCode.get(projection.code)??[];matches.push(handle);byCode.set(projection.code,matches);
   }
  }
  for(const handle of index.indexedHeadingContextCandidates()){
   const original=index.read(handle),projection=Object.freeze({...original,sourceOrdinal});
   records.set(handle,{index,original,projection});headingHandles.push(handle);
  }
 }
 if(instructionHandles.length>512)throw new GoverningRuleBindingError('Combined policy clause count exceeds the original batch profile');
 const candidates=Object.freeze(handles),instructionCandidates=Object.freeze(instructionHandles),headingContextCandidates=Object.freeze(headingHandles);
 function indexedCandidates(){current();return candidates;}
 function indexedInstructionCandidates(){current();return instructionCandidates;}
 function indexedHeadingContextCandidates(){current();return headingContextCandidates;}
 function read(handle){
  const record=records.get(handle);
  if(!record)throw new GoverningRuleBindingError('Clause handle is not owned by this original source set');
  current();
  if(record.index.read(handle)!==record.original)throw new GoverningRuleBindingError('Original source clause changed');
  return record.projection;
 }
 function select(code){
  current();const matches=byCode.get(code);
  if(!matches?.length)throw new GoverningRuleBindingError('Requested clause is not in the original source set');
  if(matches.length!==1)throw new GoverningRuleBindingError('Rule code occurs in multiple sources; select its original clause handle');
  return matches[0];
 }
 function inspect(){
  current();
  return Object.freeze(indexes.map((index,sourceOrdinal)=>Object.freeze({...index.inspect(),sourceOrdinal,sourceOccurrence:sources[sourceOrdinal].occurrence})));
 }
 return Object.freeze({indexedCandidates,indexedInstructionCandidates,indexedHeadingContextCandidates,read,select,inspect});
}
