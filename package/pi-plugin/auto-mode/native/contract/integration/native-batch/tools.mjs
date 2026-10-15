import {createExecutionWrappers} from '../../lifecycle/native-program-groups/wrapper-program-lifetime.mjs';
import {ExecutionContextOwnershipError} from '../../lifecycle/execution-context-carrier/wrapper.mjs';
import {createOwnedProgramRun} from "./generated/agent-session.mjs";
import {isOwnedProgramDefinition} from "./generated/program-definition.mjs";
import {declareResultProgram} from "../../collector/program-rule-batch-sdk-copy-v2/input/program-profile-reviewed.mjs";

/**
 Install owned execution contexts before the native request sees its tool set.
 Definitions come from the actual session registry, not proposed-call metadata.
 The existing wrappers preserve original signals and reject unsupported nested calls.
 */
export function registerOwnedExecutionTools({
  session,
  producerOwner,
  stream,
  wrapToolDefinition
}){
 const {agent} = session;
 const previous=agent.prepareRequest;
 const wrappers=createExecutionWrappers({wrapToolDefinition});
 const installationState={active:true};
 const requestHooks={async prepareRequest(
   request,
   signal
 ){
  const update=previous?await Reflect.apply(
    previous,
    this,
    [
      request,
      signal
    ]
  ):undefined;
  const context=update?.context??request.context;
    const runner=session.extensionRunner;
    const executionMode=agent.toolExecution;
  // Schema data participates in native argument conversion and validation.
  // Retain descriptors, including TypeBox symbols, without freezing borrowed schemas or encoding JSON.
  // The request-wide property bound limits retained metadata; callables remain identity dependencies.
  const schemaCapture={properties:0};
  function captureSchema({
    schema,
    label
  }){
   const pending=[schema];
     const seen=new Set();
     const nodes=[];
   while(pending.length > 0){
    const node=pending.pop();
    if((node===null)||((typeof node)!=='object')
      ||seen.has(node))continue;
    seen.add(node);
    const prototype=Object.getPrototypeOf(node);
      const keys=Reflect.ownKeys(node);
    schemaCapture.properties+=keys.length+1;
    if(schemaCapture.properties>10_000)throw new ExecutionContextOwnershipError('Original request tool schemas exceed the 10000-property profile');
    if((prototype!==null)&&(prototype!==Object.prototype)
      &&(prototype!==Array.prototype))throw new ExecutionContextOwnershipError(`${label} requires ordinary schema records or arrays`);
    const entries=keys.map(function copySchemaProperty(key) {
     const descriptor=Object.getOwnPropertyDescriptor(
       node,
       key
     );
     if((!descriptor)||(!Object.hasOwn(
       descriptor,
       'value'
     )))throw new ExecutionContextOwnershipError(`${label} requires schema data properties, not accessors`);
     pending.push(descriptor.value);
     return {
       key,
       descriptor
     };
    });
    nodes.push({
      node,
      prototype,
      keys,
      entries
    });
   }
   return function assertSchemaCurrent(){
    for(const {
      node,
      prototype,
      keys,
      entries
    } of nodes){
     const currentKeys=Reflect.ownKeys(node);
     if((Object.getPrototypeOf(node)!==prototype)||(currentKeys.length!==keys.length)
       ||currentKeys.some(function differsFromSchemaKey(
       key,
       index
     ) { return (key!==keys[index]); }))throw new ExecutionContextOwnershipError(`${label} changed after request preparation`);
     for(const {
       key,
       descriptor
     } of entries){
      const current=Object.getOwnPropertyDescriptor(
        node,
        key
      );
      if((!current)||(!Object.hasOwn(
        current,
        'value'
      ))
        ||(!Object.is(
          current.value,
          descriptor.value
        ))
        ||(current.enumerable!==descriptor.enumerable)
        ||(current.configurable!==descriptor.configurable)
        ||(current.writable!==descriptor.writable))throw new ExecutionContextOwnershipError(`${label} changed after request preparation`);
     }
    }
   };
  }
  function createProgramRun(input){
   const programTools=Object.freeze(callableTools.filter(function hasDifferentDefinitionName(tool) { return (tool.name
     !==input.definition
     .name); }));
   return createOwnedProgramRun({
     session,
     input:{
       ...input,
       tools:programTools
     }
   });
  }
  const ownedTools=new Map();
  function wrapTool(name){
   if(ownedTools.has(name))return ownedTools.get(name)
     .wrapped;
   const definition=session.getToolDefinition(name);
   if(!definition)throw new ExecutionContextOwnershipError(`Native tool ${JSON.stringify(name)
     } has no original registered definition`);
   const {execute} = definition;
     const {prepareArguments} = definition;
     const {parameters} = definition;
   const {outputSchema} = definition;
     const toolExecutionMode=definition.executionMode;
   const assertParameters=captureSchema({
     schema:parameters,
     label:`Native tool ${JSON.stringify(name)} input schema`
   });
   const assertOutputSchema=captureSchema({
     schema:outputSchema,
     label:`Native tool ${JSON.stringify(name)} output schema`
   });
   const toolState={retirement:undefined};
   function current(){
    if(toolState.retirement)throw toolState.retirement.cause;
    try{
     if((!installationState.active)||(agent.prepareRequest!==prepareRequest)
       ||(session.extensionRunner!==runner)
       ||(session.getToolDefinition(name)!==definition)
       ||(definition.execute!==execute)
       ||(definition.prepareArguments!==prepareArguments)
       ||(definition.parameters!==parameters)
       ||(definition.outputSchema!==outputSchema)
       ||(definition.executionMode!==toolExecutionMode)
       ||(agent.toolExecution!==executionMode))throw new ExecutionContextOwnershipError(`Native tool ${JSON.stringify(name)
       } or its context owner changed after request preparation`);
     assertParameters();assertOutputSchema();
    }catch(error){toolState.retirement={cause:error};throw error;}
   }
   function readOrigin(carrier){
    if(carrier.stream!==stream)throw new ExecutionContextOwnershipError('Execution context belongs to another stream consumer');
    const judgment=producerOwner.judgmentFor({
      response:carrier.response,
      stream
    });
    judgment.assertExecutionEntry(carrier.token);
    const origin=judgment.executionFor(carrier.token);
    current();return origin;
   }
   function capturePreparedProgram({
     judgment,
     member
   }){
    const {prepared}=judgment.preparedMemberFor(member);
    if(prepared.name!==name)throw new ExecutionContextOwnershipError('Prepared program belongs to a different registered tool');
    current();
    const declaration=declareResultProgram({
      source:prepared.input
        .code,
      toolNames:callableTools.filter(function hasDifferentToolName(tool) { return (tool.name!==name); })
        .map(function readOriginalToolName(tool) { return (tool.name); })
    });
    const dependencies=[...new Set(declaration.sites
      .map(function readPreparedSiteName(site) { return (site.name); }))].map(function resolveOriginalChildDefinition(childName) {
     const binding=ownedTools.get(childName);
     if(!binding)throw new ExecutionContextOwnershipError('Inspected program names an unavailable original callable');
     return binding.current;
    });
    function assertProgramCurrent(){current();for(const check of dependencies)check();}
    return judgment.bindPreparedProgram({
      member,
      declaration,
      assertCurrent:assertProgramCurrent
    });
   }
   current();
   const original=wrappers.wrapRegisteredTool(
     {definition},
     runner,
     readOrigin,
     createProgramRun
   );
   const wrapped=Object.freeze({
     ...original,
     ...(isOwnedProgramDefinition(definition)?{capturePreparedProgram}:{})
   });
   ownedTools.set(
     name,
     {
       wrapped,
       current
     }
   );return wrapped;
  }
  const tools=Object.freeze((context.tools??[]).map(function retainProjectedToolDefinition(tool) {
   // The native loadout projects descriptions without changing the registered executable definition.
   const wrapped=wrapTool(tool.name);
     const projected=Object.freeze({
     ...wrapped,
     description:tool.description
   });
   ownedTools.set(
     tool.name,
     {
       ...ownedTools.get(tool.name),
       wrapped:projected
     }
   );return projected;
  }));
  // Capture inactive native callables here, without adding their declarations to the model request.
  // Both views reuse each original wrapper; later registry additions never enter this snapshot.
  const callableTools=Object.freeze(session.getCallableToolNames()
    .map(wrapTool));
  return {
    ...update,
    context:{
      ...context,
      tools
    }
  };
 }
 };
 const {prepareRequest}=requestHooks;
 agent.prepareRequest=prepareRequest;
 return function unregister(){
  installationState.active=false;
  if(agent.prepareRequest===prepareRequest)agent.prepareRequest=previous;
 };
}
