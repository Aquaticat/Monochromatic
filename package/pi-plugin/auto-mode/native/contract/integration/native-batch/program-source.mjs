import assert from 'node:assert/strict';

function once({
  source,
  before,
  after
}){
 assert.equal(
   source.split(before)
     .length,
   2,
   `Native declared-program edit: ${before}`
 );
 return source.replace(
   before,
   after
 );
}

/** Preserve the incumbent dispatcher and error identities; publish its deciding group mode with each original member. */
export function preparedDispatcherSource({
  source,
  originalUrl
}){
 const errors='export class PreparedBatchContractError extends Error {}\nexport class PreparedBatchExecutionError extends Error {\n  constructor(message,{failures,outcomes,assessmentDecision}) {\n    super(message,{cause:new AggregateError(failures)});\n    this.diagnosticRecord={outcomes,assessmentDecision};\n  }\n}';
 let value=once({
   source,
   before:errors,
   after:`export {PreparedBatchContractError,PreparedBatchExecutionError} from ${JSON.stringify(originalUrl)};`
 });
 value=once({
   source:value,
   before:'const member=Object.freeze({id:call.id,name:call.name,input:sealInput(structuredClone(sealed))});',
   after:'const member=Object.freeze({id:call.id,name:call.name,input:sealInput(structuredClone(sealed)),groupExecutionMode:serial?"sequential":"parallel"});'
 });
 return `import {PreparedBatchContractError,PreparedBatchExecutionError} from ${JSON.stringify(originalUrl)};\n${value}`;
}

/** Extend the session's existing nested runner rather than creating another queue or recorder owner. */
export function programSessionSource(source){
 let value=once({
   source,
   before:'export class AgentSession {',
   after:'export class AgentSession {\n    static { openOwnedProgram = (session,input) => Reflect.apply(originalCreateDeclaredProgram,session.#getOwnedProgramRunner(),[input]); }'
 });
 value=once({
   source:value,
   before:'    _nestedToolCalls;',
   after:'    #nestedToolCalls;'
 });
 value=value.replaceAll(
   /this\._nestedToolCalls\b/g,
   'this.#nestedToolCalls'
 );
 value=once({
   source:value,
   before:'    async _executeNestedToolCall(parentToolCallId, name, args, options) {',
   after:'    #getOwnedProgramRunner() {'
 });
 value=once({
   source:value,
   before:'            runToolCall: (toolCall, parentId, signal, onUpdate) => {',
   after:'            getContext: () => ({messages:this.agent.state.messages,tools:this.agent.state.tools}),\n            runOwnedToolCall: (call,options) => runToolCall(call,options),\n            prepareOwnedToolCall: (hook,parentId) => this._beforeToolCall(hook,parentId),\n            finishOwnedToolCall: (hook,parentId) => this._afterToolCall(hook,parentId),\n            runToolCall: (toolCall, parentId, signal, onUpdate) => {'
 });
 value=once({
   source:value,
   before:'        return this.#nestedToolCalls.execute(parentToolCallId, name, args, options);',
   after:'        return this.#nestedToolCalls;'
 });
 value=once({
   source:value,
   before:'    /** Whether `projection`,',
   after:'    async _executeNestedToolCall(parentToolCallId,name,args,options){return this.#getOwnedProgramRunner().execute(parentToolCallId,name,args,options);}\n    /** Whether `projection`,'
 });
 return `import {isOwnedProgramDefinition} from "./program-definition.mjs";\nconst originalCreateDeclaredProgram=NestedToolCallRunner.prototype.createDeclaredProgram;\nlet openOwnedProgram;\n${value}\nexport function createOwnedProgramRun({session,input}){readActiveSessionManager(session);if(!isOwnedProgramDefinition(input.definition))throw new Error("Program definition is not owned by the native factory");return openOwnedProgram(session,input);}\n`;
}

/** Bind the existing decoder's declaration to the original prepared member before policy review. */
export function programJudgmentSource(source){
 const importLine=source.split('\n')
   .find(function isResultProgramImport(line) { return (line.startsWith('import {declareResultProgram} ')); });
 assert.ok(
   importLine,
   'Original program decoder import is unavailable'
 );
 let value=once({
   source,
   before:importLine,
   after:`import {assertDeclaredProgram} from ${JSON.stringify(new URL(
     "../../collector/program-rule-batch-sdk-copy-v2/input/program-profile.mjs",
     import.meta.url
   ).href)};`
 });
 value=once({
   source:value,
   before:'    function dependencyCheck(read){',
   after:`    function assertPreparedProgramDependencies(){
      for(const member of byMember.values())bindings.get(member).preparedProgram?.assertCurrent();
    }
    function dependencyCheck(read){`
 });
 value=once({
   source:value,
   before:'      try{return read();}',
   after:'      try{const value=read();if(!bindingSegmentActive)assertPreparedProgramDependencies();return value;}'
 });
 value=once({
   source:value,
   before:'    function openProgram({parentToken,toolNames}){',
   after:`    function bindPreparedProgram({member,declaration,assertCurrent}){
      const record=knownMember(member);
      if(record.parent!==undefined||record.execution)throw new JudgmentConstructionError('Prepared program inspection requires an unentered original root member');
      if(record.preparedProgram)throw new JudgmentConstructionError('Original prepared program inspection is already bound');
      if(typeof assertCurrent!=='function')throw new JudgmentConstructionError('Prepared program requires its original tool-dependency reader');
      assertDeclaredProgram(declaration);
      if(declaration.source!==record.prepared.input.code)throw new JudgmentConstructionError('Inspected program differs from the original prepared source');
      ready();dependencyCheck(assertCurrent);ready();
      const view=Object.freeze({kind:'original-prepared-program-inspection',member,prepared:record.prepared,declaration,permission:false});
      record.preparedProgram={view,assertCurrent};return view;
    }
    function preparedProgramFor(member){
      const record=knownMember(member);assertDependenciesCurrent();parentCurrent(record);
      return record.preparedProgram?.view;
    }
    function openProgram({parentToken,toolNames}){`
 });
 value=once({
   source:value,
   before:'        const declaration=declareResultProgram({source:record.prepared.input.code,toolNames});',
   after:`        const declaration=record.preparedProgram?.view.declaration;
        if(!declaration)throw new JudgmentConstructionError('Native program requires its original declaration captured before policy review');
        if(!Array.isArray(toolNames)||declaration.sites.some(site=>!toolNames.includes(site.name)))throw new JudgmentConstructionError('Runtime callables differ from the original prepared program');`
 });
 value=once({
   source:value,
   before:"status:scope.status,failure:scope.failure,producerValueReady:",
   after:"status:scope.status,failure:scope.failure,declaration:scope.declaration,producerValueReady:"
 });
 value=once({
   source:value,
   before:'memberExecutions:memberExecutionStates(),rootPrograms:',
   after:'memberExecutions:memberExecutionStates(),preparedPrograms:Object.freeze([...byMember.values()].flatMap(member=>{const inspection=bindings.get(member).preparedProgram;return inspection?[inspection.view]:[];})),rootPrograms:'
 });
 return once({
   source:value,
   before:'const judgment=Object.freeze({openProgram:',
   after:'const judgment=Object.freeze({bindPreparedProgram:input=>operation(()=>bindPreparedProgram(input)),preparedProgramFor:member=>operation(()=>preparedProgramFor(member)),openProgram:'
 });
}

/** Use the original request's executable tools, not a later registry lookup, for every reached group. */
export function programRunnerSource(source){
 let value=once({
   source,
   before:'createDeclaredProgram({origin,carrier,code,assertParentCurrent}){',
   after:'createDeclaredProgram({origin,carrier,code,assertParentCurrent,tools}){\n      if(!Array.isArray(tools)||!Object.isFrozen(tools))throw new Error("Original request tool snapshot is unavailable");'
 });
 value=once({
   source:value,
   before:'toolNames=this.host.getTools().map(tool=>tool.name)',
   after:'toolNames=tools.map(tool=>tool.name)'
 });
 value=once({
   source:value,
   before:'this.#bindGroup({origin,carrier,group,assertParentCurrent})',
   after:'this.#bindGroup({origin,carrier,group,assertParentCurrent,tools})'
 });
 value=once({
   source:value,
   before:'    #bindGroup({origin,carrier,group,assertParentCurrent}){',
   after:'    #bindGroup({origin,carrier,group,assertParentCurrent,tools}){'
 });
 return once({
   source:value,
   before:',tools=this.host.getTools(),nativeRun=this.host.runOwnedToolCall',
   after:',nativeRun=this.host.runOwnedToolCall'
 });
}

/** Keep native sandbox/result handling while routing declared callsites through existing original program slots. */
export function programExecutorSource(source){
 let value=once({
   source,
   before:'    const sandboxTools = callable.map((tool) => ({',
   after:'    if(!ctx||typeof ctx.createDeclaredProgram!=="function")throw new Error("Owned native program context is unavailable");\n    const programRun=ctx.createDeclaredProgram({code:input.code});\n    const sandboxTools = programRun.tools.map((member,index) => {\n        const tool=callable.find(value=>value.name===programRun.declaration.sites[index].name);\n        if(!tool)throw new Error("Declared native child is no longer callable");\n        return ({'
 });
 value=once({
   source:value,
   before:'        name: tool.name,\n        description: samples.get(tool.name),',
   after:'        name: member.name,\n        description: samples.get(tool.name),'
 });
 value=once({
   source:value,
   before:'const outcome = await ctx.executeTool(tool.name, args, { signal: callSignal });',
   after:'const outcome = await member.execute(args, { signal: callSignal });'
 });
 value=once({
   source:value,
   before:'return toScriptValue(tool, outcome);',
   after:'return programRun.valueFor({tool:member,outcome});'
 });
 value=once({
   source:value,
   before:'    }));\n    const sandbox = new CodemodeSandbox({',
   after:'    });});\n    const sandbox = new CodemodeSandbox({'
 });
 return once({
   source:value,
   before:'result = await sandbox.execute(code, { signal, store });',
   after:'result = await sandbox.execute(programRun.declaration.compiledSource, { signal, store });'
 });
}

/** Extract the installed conversion functions for the incumbent native-return consumer. */
export function nativeScriptValueSource({
  source,
  parse
}){
 const parsed=parse(
   source,
   {
     sourceType:'module',
     lang:'js',
     preserveParens:true,
     semanticErrors:true
   }
 );
 assert.deepEqual(
   parsed.diagnostics,
   []
 );
 return `${[
   'textOf',
   'toScriptValue'
 ].map(function prepareNativeValueFunctionEdit(name) {
  const nodes=parsed.program
    .body
    .filter(function isNamedFunctionDeclaration(node) { return ((node.type==='FunctionDeclaration')&&(node.id
      ?.name
      ===name)); });
  assert.equal(
    nodes.length,
    1,
    `Native script value function: ${name}`
  );
  const [node]=nodes;
  const body=source.slice(
    node.start,
    node.end
  );
  assert.ok(body.startsWith(`function ${name
    }(`));
  return (name==='toScriptValue'?'export ':'')+body;
 })
   .join('\n\n')}\n`;
}

/** Rebase the existing factory-closure definition identity; equal schemas and names do not authenticate copies. */
export function programDefinitionSource({
  nativeToolUrl,
  executorUrl
}){
 return `import {createCodemodeToolDefinition} from ${JSON.stringify(nativeToolUrl)};\n`
  +`const definitions=new WeakSet();\n`
   +`export function createOwnedCodemodeDefinition(options={}){const fixedOptions=Object.freeze({...options});const original=createCodemodeToolDefinition(fixedOptions);const definition=Object.freeze({...original,defaultActive:false,execute:async(...args)=>(await import(${JSON.stringify(executorUrl)})).executeCodemode(...args,fixedOptions)});definitions.add(definition);return definition;}\n`
   +`export function isOwnedProgramDefinition(definition){return definitions.has(definition);}\n`;
}
