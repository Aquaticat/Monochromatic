/**
 Preserve original native program ownership while preparing qualified SDK source.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { privatizeNativeMembers } from './build-members.ts';
export { programJudgmentSource } from './program-judgment-source.ts';
export { nativeScriptValueSource } from './program-value-source.ts';

//region Original program source boundaries retain their native execution and judgment owners

/**
 Program preparation retains diagnostics separate from execution authority.
 */
const l = tagged({ tag: 'auto-mode-native-program-source' });

/**
 Preserve the incumbent dispatcher and error identities; publish its deciding group mode with each original member.

 @param source - original prepared dispatcher module

 @param originalUrl - original dispatcher module retaining shared error identities

 @returns generated source retaining original program ownership boundaries

 @throws NativeBatchBuildError when original source qualification changes

 @example
 ```ts
 const generated = preparedDispatcherSource({ source, originalUrl });
 ```
 */
export function preparedDispatcherSource({
  source,
  originalUrl
}: { readonly source: string; readonly originalUrl: string }): string {
 /**
  Each original program transformation retains its own diagnostic boundary.
  */
 const rl = tagged({ tag: preparedDispatcherSource.name, l });
 rl.debug('preparing original native program source');
 /**
  Error identities stay attached to the original dispatcher module.
  */
 const errors='export class PreparedBatchContractError extends Error {}\nexport class PreparedBatchExecutionError extends Error {\n  constructor(message,{failures,outcomes,assessmentDecision}) {\n    super(message,{cause:new AggregateError(failures)});\n    this.diagnosticRecord={outcomes,assessmentDecision};\n  }\n}';
 /**
  shared errors retains its original source occurrence before the next transformation.
  */
 const sharedErrors=replaceOnce({
   source,
   from:errors,
   to:`export {PreparedBatchContractError,PreparedBatchExecutionError} from ${JSON.stringify(originalUrl)};`
 });
 /**
  group mode retains its original source occurrence before the next transformation.
  */
 const groupMode=replaceOnce({
   source:sharedErrors,
   from:'const member=Object.freeze({id:call.id,name:call.name,input:sealInput(structuredClone(sealed))});',
   to:'const member=Object.freeze({id:call.id,name:call.name,input:sealInput(structuredClone(sealed)),groupExecutionMode:serial?"sequential":"parallel"});'
 });
 return `import {PreparedBatchContractError,PreparedBatchExecutionError} from ${JSON.stringify(originalUrl)};\n${groupMode}`;
}


/**
 Extend the session's existing nested runner rather than creating another queue or recorder owner.

 @param source - qualified original module before program observation

 @returns generated source retaining original program ownership boundaries

 @throws NativeBatchBuildError when original source qualification changes

 @example
 ```ts
 const generated = programSessionSource(source);
 ```
 */
export function programSessionSource(source: string): string {
 /**
  Each original program transformation retains its own diagnostic boundary.
  */
 const rl = tagged({ tag: programSessionSource.name, l });
 rl.debug('preparing original native program source');
 /**
  opened session retains its original source occurrence before the next transformation.
  */
 const openedSession=replaceOnce({
   source,
   from:'export class AgentSession {',
   to:'export class AgentSession {\n    static { openOwnedProgram = (session,input) => Reflect.apply(originalCreateDeclaredProgram,session.#getOwnedProgramRunner(),[input]); }'
 });
 /**
  declared runner retains its original source occurrence before the next transformation.
  */
 const declaredRunner=replaceOnce({
   source:openedSession,
   from:'    _nestedToolCalls;',
   to:'    #_nestedToolCalls;'
 });
 /**
  private runner retains its original source occurrence before the next transformation.
  */
 const privateRunner=privatizeNativeMembers({ source: declaredRunner, members: ['_nestedToolCalls'] });
 /**
  runner access retains its original source occurrence before the next transformation.
  */
 const runnerAccess=replaceOnce({
   source:privateRunner,
   from:'    async _executeNestedToolCall(parentToolCallId, name, args, options) {',
   to:'    #getOwnedProgramRunner() {'
 });
 /**
  context runner retains its original source occurrence before the next transformation.
  */
 const contextRunner=replaceOnce({
   source:runnerAccess,
   from:'            runToolCall: (toolCall, parentId, signal, onUpdate) => {',
   to:'            getContext: () => ({messages:this.agent.state.messages,tools:this.agent.state.tools}),\n            runOwnedToolCall: (call,options) => runToolCall(call,options),\n            prepareOwnedToolCall: (hook,parentId) => this._beforeToolCall(hook,parentId),\n            finishOwnedToolCall: (hook,parentId) => this._afterToolCall(hook,parentId),\n            runToolCall: (toolCall, parentId, signal, onUpdate) => {'
 });
 /**
  returned runner retains its original source occurrence before the next transformation.
  */
 const returnedRunner=replaceOnce({
   source:contextRunner,
   from:'        return this.#_nestedToolCalls.execute(parentToolCallId, name, args, options);',
   to:'        return this.#_nestedToolCalls;'
 });
 /**
  nested entry retains its original source occurrence before the next transformation.
  */
 const nestedEntry=replaceOnce({
   source:returnedRunner,
   from:'    /** Whether `projection`,',
   to:'    async _executeNestedToolCall(parentToolCallId,name,args,options){return this.#getOwnedProgramRunner().execute(parentToolCallId,name,args,options);}\n    /** Whether `projection`,'
 });
 return `import {isOwnedProgramDefinition} from "./program-definition.mjs";\nconst originalCreateDeclaredProgram=NestedToolCallRunner.prototype.createDeclaredProgram;\nlet openOwnedProgram;\n${nestedEntry}\nexport function createOwnedProgramRun({session,input}){readActiveSessionManager(session);if(!isOwnedProgramDefinition(input.definition))throw new Error("Program definition is not owned by the native factory");return openOwnedProgram(session,input);}\n`;
}


/**
 Use the original request's executable tools, not a later registry lookup, for every reached group.

 @param source - qualified original module before program observation

 @returns generated source retaining original program ownership boundaries

 @throws NativeBatchBuildError when original source qualification changes

 @example
 ```ts
 const generated = programRunnerSource(source);
 ```
 */
export function programRunnerSource(source: string): string {
 /**
  Each original program transformation retains its own diagnostic boundary.
  */
 const rl = tagged({ tag: programRunnerSource.name, l });
 rl.debug('preparing original native program source');
 /**
  tool snapshot retains its original source occurrence before the next transformation.
  */
 const toolSnapshot=replaceOnce({
   source,
   from:'createDeclaredProgram({origin,carrier,code,assertParentCurrent}){',
   to:'createDeclaredProgram({origin,carrier,code,assertParentCurrent,tools}){\n      if(!Array.isArray(tools)||!Object.isFrozen(tools))throw new Error("Original request tool snapshot is unavailable");'
 });
 /**
  tool names retains its original source occurrence before the next transformation.
  */
 const toolNames=replaceOnce({
   source:toolSnapshot,
   from:'toolNames=this.host.getTools().map(tool=>tool.name)',
   to:'toolNames=tools.map(tool=>tool.name)'
 });
 /**
  forwarded tools retains its original source occurrence before the next transformation.
  */
 const forwardedTools=replaceOnce({
   source:toolNames,
   from:'this.#bindGroup({origin,carrier,group,assertParentCurrent})',
   to:'this.#bindGroup({origin,carrier,group,assertParentCurrent,tools})'
 });
 /**
  group tools retains its original source occurrence before the next transformation.
  */
 const groupTools=replaceOnce({
   source:forwardedTools,
   from:'    #bindGroup({origin,carrier,group,assertParentCurrent}){',
   to:'    #bindGroup({origin,carrier,group,assertParentCurrent,tools}){'
 });
 return replaceOnce({
   source:groupTools,
   from:',tools=this.host.getTools(),nativeRun=this.host.runOwnedToolCall',
   to:',nativeRun=this.host.runOwnedToolCall'
 });
}


/**
 Keep native sandbox/result handling while routing declared callsites through existing original program slots.

 @param source - qualified original module before program observation

 @returns generated source retaining original program ownership boundaries

 @throws NativeBatchBuildError when original source qualification changes

 @example
 ```ts
 const generated = programExecutorSource(source);
 ```
 */
export function programExecutorSource(source: string): string {
 /**
  Each original program transformation retains its own diagnostic boundary.
  */
 const rl = tagged({ tag: programExecutorSource.name, l });
 rl.debug('preparing original native program source');
 /**
  program tools retains its original source occurrence before the next transformation.
  */
 const programTools=replaceOnce({
   source,
   from:'    const sandboxTools = callable.map((tool) => ({',
   to:'    if(!ctx||typeof ctx.createDeclaredProgram!=="function")throw new Error("Owned native program context is unavailable");\n    const programRun=ctx.createDeclaredProgram({code:input.code});\n    const sandboxTools = programRun.tools.map((member,index) => {\n        const tool=callable.find(value=>value.name===programRun.declaration.sites[index].name);\n        if(!tool)throw new Error("Declared native child is no longer callable");\n        return ({'
 });
 /**
  member names retains its original source occurrence before the next transformation.
  */
 const memberNames=replaceOnce({
   source:programTools,
   from:'        name: tool.name,\n        description: samples.get(tool.name),',
   to:'        name: member.name,\n        description: samples.get(tool.name),'
 });
 /**
  member execution retains its original source occurrence before the next transformation.
  */
 const memberExecution=replaceOnce({
   source:memberNames,
   from:'const outcome = await ctx.executeTool(tool.name, args, { signal: callSignal });',
   to:'const outcome = await member.execute(args, { signal: callSignal });'
 });
 /**
  member value retains its original source occurrence before the next transformation.
  */
 const memberValue=replaceOnce({
   source:memberExecution,
   from:'return toScriptValue(tool, outcome);',
   to:'return programRun.valueFor({tool:member,outcome});'
 });
 /**
  sandbox shape retains its original source occurrence before the next transformation.
  */
 const sandboxShape=replaceOnce({
   source:memberValue,
   from:'    }));\n    const sandbox = new CodemodeSandbox({',
   to:'    });});\n    const sandbox = new CodemodeSandbox({'
 });
 return replaceOnce({
   source:sandboxShape,
   from:'result = await sandbox.execute(code, { signal, store });',
   to:'result = await sandbox.execute(programRun.declaration.compiledSource, { signal, store });'
 });
}


/**
 Rebase the existing factory-closure definition identity; equal schemas and names do not authenticate copies.

 @param nativeToolUrl - original native definition factory URL

 @param executorUrl - generated executor URL retaining its original program owner

 @returns generated source retaining original program ownership boundaries

 @throws NativeBatchBuildError when original source qualification changes

 @example
 ```ts
 const generated = programDefinitionSource({ nativeToolUrl, executorUrl });
 ```
 */
export function programDefinitionSource({
  nativeToolUrl,
  executorUrl
}: { readonly nativeToolUrl: string; readonly executorUrl: string }): string {
 /**
  Each original program transformation retains its own diagnostic boundary.
  */
 const rl = tagged({ tag: programDefinitionSource.name, l });
 rl.debug('preparing original native program source');
 return `import {createCodemodeToolDefinition} from ${JSON.stringify(nativeToolUrl)};\n`
  +`const definitions=new WeakSet();\n`
   +`export function createOwnedCodemodeDefinition(options={}){const fixedOptions=Object.freeze({...options});const original=createCodemodeToolDefinition(fixedOptions);const definition=Object.freeze({...original,defaultActive:false,execute:async(...args)=>(await import(${JSON.stringify(executorUrl)})).executeCodemode(...args,fixedOptions)});definitions.add(definition);return definition;}\n`
   +`export function isOwnedProgramDefinition(definition){return definitions.has(definition);}\n`;
}

//endregion Original program source boundaries retain their native execution and judgment owners
