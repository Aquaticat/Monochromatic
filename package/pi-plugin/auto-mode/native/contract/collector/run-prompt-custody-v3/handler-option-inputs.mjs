import {createHash} from 'node:crypto';
import {SourceCollectionError} from '../collector.mjs';

/**
 * Represent already-owned callback option snapshots, not a second native observation or caller coverage claim.
 * The run owner supplies validated immutable snapshots; the run publication authenticates membership.
 */
export function captureHandlerOptionInputs({observations,runOccurrence}){
 if(observations.length>64)throw new SourceCollectionError('Original callback option sources exceed the governing 64-source profile');
 return Object.freeze(observations.map(observation=>{
  const content=JSON.stringify(observation.before.options);
  if(Buffer.byteLength(content)>65536)throw new SourceCollectionError('Original callback option input exceeds the source byte bound');
  return Object.freeze({kind:'native-run-handler-options-input',content,contentFormat:'native-content-json',
   inputLocation:Object.freeze({field:'handlerOptions',ordinal:observation.ordinal,metadataJSON:JSON.stringify({method:'before_agent_start',phase:'input',contentFormat:'native-content-json'})}),
   sha256:createHash('sha256').update(content).digest('hex'),occurrence:Object.freeze({}),runOccurrence,registration:undefined,permission:false});
 }));
}
