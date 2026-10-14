import {RootLeaseOwnershipError} from './lifecycle.mjs';

/** Bind only native SDK readers supplied by the trusted construction owner. */
export function createSessionRootReader({
  readActiveSessionManager,
  readManagerOccurrence
}){
  if(((typeof readActiveSessionManager)!=='function')||((typeof readManagerOccurrence)!=='function'))throw new RootLeaseOwnershipError('Native session and manager readers are required');
  return function readRootOccurrence({
    session,
    manager
  }){
    if(readActiveSessionManager(session)!==manager)throw new RootLeaseOwnershipError('SDK session is not bound to this exact manager');
    return readManagerOccurrence(manager);
  };
}
