import {RootLeaseOwnershipError} from '../runtime-root-lifecycle/lifecycle.mjs';

//region Native constructor results, not metadata or class-shaped values, establish manager ownership.
export function createManagerConstructorOwner(SessionManager){
  const owned=new WeakSet(),counts={create:0,open:0,inMemory:0};
  const create=SessionManager.create,open=SessionManager.open,inMemory=SessionManager.inMemory;
  if([create,open,inMemory].some(value=>typeof value!=='function'))throw new RootLeaseOwnershipError('Native manager constructors are unavailable');
  function register({value,kind}){
    if(value===null||typeof value!=='object')throw new RootLeaseOwnershipError('Native constructor did not return a manager object');
    owned.add(value);counts[kind]+=1;return value;
  }
  const managers=Object.freeze({
    create(...args){return register({value:Reflect.apply(create,SessionManager,args),kind:'create'});},
    open(...args){return register({value:Reflect.apply(open,SessionManager,args),kind:'open'});},
    inMemory(...args){return register({value:Reflect.apply(inMemory,SessionManager,args),kind:'inMemory'});},
  });
  function assertOwned(manager){if(!owned.has(manager))throw new RootLeaseOwnershipError('Manager was not returned by this declared constructor owner');}
  function diagnostics(){return Object.freeze({...counts});}
  return Object.freeze({managers,assertOwned,diagnostics});
}
//endregion
