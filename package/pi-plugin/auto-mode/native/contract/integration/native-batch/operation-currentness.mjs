import {
  readActiveSessionManager,
  readSessionDisposalState
} from './generated/agent-session.mjs';
import {readRootOccurrence} from './generated/session-manager.mjs';
import {tagged} from '@monochromatic-dev/module-logger/ts';

//region Each operation captures the current native branch without owning navigation.
export class NativeOperationStaleError extends Error {}

/** Keep stale decisions stale while allowing new work on the current native branch. */
export function createOperationCurrentness({
  session,
  manager
}){
 const l=tagged({
   tag:createOperationCurrentness.name,
   l:tagged({tag:'auto-mode-operation-currentness'})
 });
 const operations=new WeakMap();
 function readCurrent(){
  tagged({
    tag:readCurrent.name,
    l
  })
    .debug('reading native operation occurrence');
  const disposal=readSessionDisposalState(session);
  if(disposal.entered)throw new NativeOperationStaleError('Session disposal invalidated this tool decision');
  if(readActiveSessionManager(session)!==manager)throw new NativeOperationStaleError('Session manager changed during this tool decision');
  return readRootOccurrence(manager);
 }
 function capture(root){
  tagged({
    tag:capture.name,
    l
  })
    .debug('capturing current native operation');
  if((root.session!==session)||(root.manager!==manager))throw new NativeOperationStaleError('Operation belongs to another session');
  const operation=Object.freeze({});
  operations.set(
    operation,
    {
      occurrence:readCurrent(),
      stale:false
    }
  );
  return operation;
 }
 function assertActive(operation){
  tagged({
    tag:assertActive.name,
    l
  })
    .debug('checking current native operation');
  const state=operations.get(operation);
  if((!state)||state.stale)throw new NativeOperationStaleError('Tool decision is no longer current');
  try{
   if(readCurrent()!==state.occurrence)throw new NativeOperationStaleError('Session branch changed during this tool decision');
  }catch(error){state.stale=true;throw error;}
 }
 return Object.freeze({
   capture,
   assertActive
 });
}
//endregion
