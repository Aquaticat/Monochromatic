import {createRegisteredWrappers} from '../nested-context-cancellation/wrapper.mjs';

export class ExecutionContextOwnershipError extends Error {constructor(message){super(message);this.name=this.constructor
  .name;}}
export class NestedGroupSupportError extends Error {constructor(){super('Complete nested group admission is unavailable for this parent execution');this.name=this.constructor
  .name;}}

//region Explicit native context carriage; opaque occurrence ownership is not permission.
/** Fixed session-specific reader must resolve the actual producer judgment and its active execution token. */
export function createExecutionWrappers({
  wrapToolDefinition,
  executeNestedGroup
}) {
  const native=createRegisteredWrappers({wrapToolDefinition});
    const contexts=new WeakMap();
    const issued=new WeakMap();
  const activity={changing:false};
  /** Keep callback reentrancy closed until the synchronous context operation returns. */
  function operation(run){
    if(activity.changing)throw new ExecutionContextOwnershipError('Native context operations cannot reenter through callbacks');
    activity.changing=true;
    using scope={ [Symbol.dispose]() { activity.changing=false; } };
    return run();
  }
  function wrapRegisteredTool({
    registeredTool,
    runner,
    readOrigin
  }){
    if((typeof readOrigin)!=='function')throw new ExecutionContextOwnershipError('Registered native context requires its fixed session execution reader');
    const original=native.wrapRegisteredTool({
      registeredTool,
      runner
    });
      const {name} = registeredTool.definition;
      const receiver=Object.freeze({});
    function current(record){
      if(readOrigin(record.carrier)!==record.origin)throw new ExecutionContextOwnershipError('Native execution origin changed after context creation');
    }
    function createExecutionContext({
      carrier,
      toolCallId,
      params,
      signal,
      onUpdate
    }){return operation(function bindNativeExecutionContext() {
      const origin=readOrigin(carrier);
      if((origin.prepared
        .id
        !==toolCallId)||(origin.prepared
          .name
          !==name)
        ||(origin.signal!==signal))throw new ExecutionContextOwnershipError('Native context receiver, member or original signal differs from its execution occurrence');
      if((!Object.isFrozen(params))||(JSON.stringify(params)!==JSON.stringify(origin.prepared
        .input)))throw new ExecutionContextOwnershipError('Native arguments differ from the sealed prepared member');
      if(issued.has(carrier.token))throw new ExecutionContextOwnershipError('Execution occurrence already reserved its native context');
      const record={
        receiver,
        carrier:Object.freeze({
          response:carrier.response,
          stream:carrier.stream,
          token:carrier.token
        }),
        origin,
        toolCallId,
        params,
        signal,
        onUpdate,
        state:'constructing',
        context:undefined
      };
      issued.set(
        carrier.token,
        record
      );
      try {
        const base=runner.createToolContext(
          toolCallId,
          signal
        );
          const descriptors=Object.getOwnPropertyDescriptors(base);
        if((typeof descriptors.executeTool
          ?.value)!=='function')throw new ExecutionContextOwnershipError('Native context factory omitted executeTool');
        const context=Object.defineProperties(
          Object.create(Object.getPrototypeOf(base)),
          {
            ...descriptors,
            executeTool:{
              ...descriptors.executeTool,
              value:async function executeOriginalNestedGroup(
                childName,
                args,
                options
              ) {
          const input=operation(function captureNestedInvocationInput() {
            if(record.state!=='running')throw new ExecutionContextOwnershipError('Parent native execution is not active for another nested invocation');
            current(record);
            if((typeof executeNestedGroup)!=='function')throw new NestedGroupSupportError();
            return Object.freeze({
              carrier:record.carrier,
              origin:record.origin,
              name:childName,
              args,
              options
            });
          });
          return await executeNestedGroup(input);
        }
            }
          }
        );
        current(record);record.context=context;record.state='issued';contexts.set(
          context,
          record
        );return context;
      }catch(error){record.state='failed';throw error;}
    });}
    /** Preserve the native positional execute callback behind its original wrapper owner. */
    function createExecutionCallback() {
      return async function execute(
      toolCallId,
      params,
      signal,
      onUpdate,
      context
    ){
      const record=operation(function beginNativeContextExecution() {
      const currentContext=contexts.get(context);
      if((!currentContext)||(currentContext.receiver!==receiver)
        ||(currentContext.context!==context)
        ||(currentContext.origin
          .prepared
          .name
          !==name))throw new ExecutionContextOwnershipError('Native execution requires its exact issued context');
      if(currentContext.state!=='issued')throw new ExecutionContextOwnershipError('Native execution context cannot be replayed');
      if((currentContext.toolCallId!==toolCallId)||(currentContext.params!==params)
        ||(currentContext.signal!==signal)
        ||(currentContext.onUpdate!==onUpdate))throw new ExecutionContextOwnershipError('Native execution arguments or callbacks differ from context issuance');
      current(currentContext);
      if(JSON.stringify(params)!==JSON.stringify(currentContext.origin
        .prepared
        .input))throw new ExecutionContextOwnershipError('Prepared native arguments changed before execution');
      currentContext.state='running';return currentContext;
      });
      using executionScope={ [Symbol.dispose]() { record.state='returned'; } };
      return await original.execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        context
      );
    }
    }
    return {
      ...original,
      createExecutionContext,
      execute:createExecutionCallback()
    };
  }
  function wrapRegisteredTools({
    registeredTools,
    runner,
    readOrigin
  }){return registeredTools.map(function wrapOriginalExecutionTool(tool) { return (wrapRegisteredTool({
    registeredTool:tool,
    runner,
    readOrigin
  })); });}
  return Object.freeze({
    wrapRegisteredTool,
    wrapRegisteredTools
  });
}
//endregion
