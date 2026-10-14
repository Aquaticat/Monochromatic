/** Private SDK delta: delegate the complete native group or withhold every member. */
export const batchBoundary = `async function executeToolCalls(currentContext, assistantMessage, config, signal, emit) {
    const calls = assistantMessage.content.filter(part => part.type === "toolCall");
    const started = new Set();
    const finished = new Map();
    let terminationRequested = false;
    async function start(call) {
        started.add(call.id);
        await emit({type:"tool_execution_start",toolCallId:call.id,toolName:call.name,args:call.arguments});
    }
    async function finish(outcome) {
        finished.set(outcome.toolCall.id,outcome);
        await emitToolExecutionEnd(outcome,emit);
    }
    try {
        if (typeof config.executeToolBatch !== "function") throw new Error("These tool calls were not run because the host did not configure their combined policy review.");
        if (!signal) throw new Error("Original run cancellation is unavailable for these tool calls.");
        await config.executeToolBatch({
            assistantMessage,context:currentContext,signal,runToolCall,
            executionMode:config.toolExecution ?? "parallel",
            beforeToolCall:config.beforeToolCall ? async (context,signal) => {
                const result = await config.beforeToolCall(context,signal);
                if (result?.block && result.terminate === true) terminationRequested = true;
                return result;
            } : undefined,
            afterToolCall:config.afterToolCall,
            onStart:start,onFinish:finish,
            onUpdate:async (partial,call) => emit({type:"tool_execution_update",toolCallId:call.id,toolName:call.name,args:call.arguments,partialResult:partial})
        });
        if (calls.some(call => !finished.has(call.id))) throw new Error("Combined review omitted an original tool outcome");
    } catch (error) {
        for (const item of error?.diagnosticRecord?.outcomes ?? []) {
            if (item.status === "fulfilled" && item.value?.toolCall && !finished.has(item.value.toolCall.id)) await finish(item.value);
        }
        for (const call of calls) {
            if (!started.has(call.id)) await start(call);
            if (!finished.has(call.id)) {
                const result = createErrorToolResult("Complete tool group was not released: " + (error instanceof Error ? error.message : String(error)));
                await finish({toolCall:call,result,isError:true});
            }
        }
    }
    const finalizedCalls = calls.map(call => finished.get(call.id));
    const messages = [];
    for (const finalized of finalizedCalls) {
        if (!finalized) throw new Error("Complete tool group lost an original native outcome");
        const message = createToolResultMessage(finalized);
        await emitToolResultMessage(message,emit);
        messages.push(message);
    }
    return {messages,terminate:terminationRequested || shouldTerminateToolBatch(finalizedCalls)};
}
`;
