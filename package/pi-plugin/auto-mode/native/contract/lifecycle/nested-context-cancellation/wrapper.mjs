//region Per-invocation context lifetime, not nested semantic admission or permission.
export class NestedContextClosedError extends Error {
  constructor(toolCallId) {
    super(`Tool call ${JSON.stringify(toolCallId)} has returned; its context cannot start another nested call`);
    this.name=this.constructor
      .name;
  }
}

/** Preserve lazy native context getters and only narrow the lifetime of nested invocation. */
function guardContext({
  context,
  toolCallId,
  isActive,
  signal
}) {
  const descriptors=Object.getOwnPropertyDescriptors(context);
    const descriptor=descriptors.executeTool;
  if((!descriptor)||((typeof descriptor.value)!=='function'))throw new TypeError('Native tool context has no data-method executeTool');
  const invoke=descriptor.value;
  return Object.defineProperties(
    Object.create(Object.getPrototypeOf(context)),
    {
    ...descriptors,
    executeTool:{
      ...descriptor,
      value:async function executeWithinParentCancellation(
        name,
        args,
        options
      ) {
      if(!isActive())throw new NestedContextClosedError(toolCallId);
      let effectiveOptions=options;
      if(signal!==undefined){
        const requested=options===undefined?undefined:options.signal;
        const effectiveSignal=(requested===undefined)||(requested===signal)?signal:AbortSignal.any([
          signal,
          requested
        ]);
        effectiveOptions={
          ...options,
          signal:effectiveSignal
        };
      }
      return await invoke(
        name,
        args,
        effectiveOptions
      );
    }
    },
  }
  );
}

/** Extend the existing registered wrapper; no session/root registry or new judgment is created. */
export function createRegisteredWrappers({wrapToolDefinition}) {
  function wrapRegisteredTool({
    registeredTool,
    runner
  }) {
    const {definition} = registeredTool;
    const guardedDefinition={
      ...definition,
      async execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        context
      ){
      const lifetime={active:true};
      const guarded=guardContext({
        context,
        toolCallId,
        isActive:function isParentExecutionActive() { return (lifetime.active); },
        signal
      });
      using executionScope={ [Symbol.dispose]() { lifetime.active=false; } };
      return await definition.execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        guarded
      );
    }
    };
    return wrapToolDefinition(
      guardedDefinition,
      function createOriginalToolContext(
        toolCallId,
        signal
      ) { return (runner.createToolContext(
        toolCallId,
        signal
      )); }
    );
  }
  function wrapRegisteredTools({
    registeredTools,
    runner
  }){return registeredTools.map(function wrapOriginalCancellationTool(tool) { return (wrapRegisteredTool({
    registeredTool:tool,
    runner
  })); });}
  return Object.freeze({
    wrapRegisteredTool,
    wrapRegisteredTools
  });
}
//endregion
