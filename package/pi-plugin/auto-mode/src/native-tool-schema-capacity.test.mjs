import assert from 'node:assert/strict';
import {registerOwnedExecutionTools} from '../dist/native/contract/integration/native-batch/tools.mjs';
import {ExecutionContextOwnershipError} from '../dist/native/contract/lifecycle/execution-context-carrier/wrapper.mjs';

//region Complete registered schemas retain their descriptors without a catalog-size ceiling.
/** Exercise the original request hook, including inactive registered callables. */
async function prepare(parameters){
 const definition={name:'fixture',parameters,outputSchema:{type:'string'},execute(){throw new Error('No execution expected');}};
 const stream={};
 const token={};
 const origin={};
 const session={agent:{toolExecution:'parallel'},extensionRunner:{},getToolDefinition(){return definition;},getCallableToolNames(){return ['fixture'];}};
 const unregister=registerOwnedExecutionTools({session,stream,producerOwner:{},manualOrigins:new Map([[token,function readManual(){return origin;}]]),wrapToolDefinition(value){return value;}});
 const prepared=await session.agent.prepareRequest({context:{tools:[definition]}},undefined);
 return {session,definition,unregister,wrapped:prepared.context.tools[0],carrier:{stream,token}};
}
const properties=Object.fromEntries(Array.from({length:12_000},function field(_,index){return [`field${index}`,{type:'string'}];}));
const parameters={type:'object',properties};
const fixture=await prepare(parameters);
assert.equal(fixture.wrapped.parameters,parameters);
assert.equal(Object.keys(fixture.wrapped.parameters.properties).length,12_000);
assert.equal(Object.isFrozen(parameters),false);
properties.field11999.type='number';
assert.throws(function changedSchema(){fixture.wrapped.createExecutionContext({carrier:fixture.carrier});},ExecutionContextOwnershipError);
fixture.unregister();
assert.equal(fixture.session.agent.prepareRequest,undefined);
let accessorCalls=0;
await assert.rejects(function accessorSchema(){return prepare({get type(){accessorCalls++;return 'string';}});},ExecutionContextOwnershipError);
assert.equal(accessorCalls,0);
await assert.rejects(function prototypeSchema(){return prepare(new Date());},ExecutionContextOwnershipError);
console.log(JSON.stringify({complete:true,properties:12_000,borrowedSchemaPreserved:true,mutationRejected:true,accessorRejected:true,prototypeRejected:true}));
//endregion
