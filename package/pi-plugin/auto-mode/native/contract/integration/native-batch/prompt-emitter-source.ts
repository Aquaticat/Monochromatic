/**
 Preserve original native prompt-emitter preparation and ownership boundaries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { NativeBatchBuildError } from './build-entries.ts';

//region Qualified native source transformations retain original prompt and input owners

/**
 Native prompt-emitter preparation retains a separate diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-prompt-emitter-source' });

/**
 Retain original before-agent-start traversal through its native run owner.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change
 */
function prepareBeforeAgentStartEmitter(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({
   tag: prepareBeforeAgentStartEmitter.name,
   l
 });
 rl.debug('preparing original native prompt source');
 /**
  The original before-agent-start method begins native run preparation.
  */
 const methodStart=source.indexOf('    async emitBeforeAgentStart(');
 /**
  The following native event method ends the before-agent-start source block.
  */
 const methodEnd=source.indexOf(
   '    async emitResourcesDiscover(',
   methodStart
 );
 if ((methodStart === (-1)) || (methodEnd <= methodStart)) throw new NativeBatchBuildError('Original native before-agent-start boundary is unavailable');
 /**
  Original handler traversal remains ordered while its capture boundaries are installed.
  */
 let emitter=source.slice(
   methodStart,
   methodEnd
 );
 /**
  Ordered exact native sites retain original handler invocation, results, errors, and completion.
  */
 const edits=[
  source.includes('    async emitBeforeAgentStart(trigger,')
   ? [
     '    async emitBeforeAgentStart(trigger, systemPromptOptions) {',
     'export async function emitOwnedBeforeAgentStart({runner,owner,scope,trigger,seed:systemPromptOptions,outputObserver}) {'
   ]
   : [
     '    async emitBeforeAgentStart(prompt, images, systemPromptOptions) {',
     'export async function emitOwnedBeforeAgentStart({runner,owner,scope,prompt,images,seed:systemPromptOptions,outputObserver}) {'
   ],
  [
    'this.createContext()',
    'Reflect.apply(nativeCreateContext,runner,[])'
  ],
  [
    'this.assertActive();',
    'Reflect.apply(nativeAssertActive,runner,[]);'
  ],
  [
    '        for (const { ext, handlers } of snapshotEventHandlers(this.extensions, "before_agent_start")) {',
    '        const snapshot = snapshotEventHandlers(runner.extensions, "before_agent_start");\n        owner.enterNative({scope,runner,seed:systemPromptOptions,working:currentOptions,snapshot,messages});\n        for (const { ext, handlers } of snapshot) {'
  ],
  [
    '                try {',
    '                await owner.invokeHandler({scope,runner,extension:ext,handler,messages,outputObserver,invoke:async()=>{'
  ],
  [
    '                    const handlerResult = await handler(event, ctx);',
    '                    const handlerResult = await handler(event, ctx);\n                    outputObserver.capture(handlerResult);'
  ],
  [
    '                }\n                catch (err) {',
    '                },reportError:(err)=>{'
  ],
  [
    '                    this.emitError({',
    '                    Reflect.apply(nativeEmitError,runner,[{'
  ],
  [
    '                        stack,\n                    });\n                }',
    '                        stack,\n                    }]);\n                }});'
  ],
  [
    '        return { messages, systemPromptOptions: currentOptions };',
    '        return owner.leaveNative({scope,runner,working:currentOptions,messages});'
  ]
 ] as const;
 for(const [before,after] of edits)emitter=replaceOnce({
   source:emitter,
   from: before,
   to: after
 });
 return emitter;
}
/**
 Retain original input traversal and capture its original handler event.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change
 */
function prepareInputEmitter(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({
   tag: prepareInputEmitter.name,
   l
 });
 rl.debug('preparing original native prompt source');
 /**
  The original input method begins retained native input handling.
  */
 const inputStart=source.indexOf('    async emitInput(');
 /**
  The original runner class boundary ends the native input method.
  */
 const inputEnd=source.indexOf(
   '\n}\n',
   inputStart
 );
 if ((inputStart === (-1)) || (inputEnd <= inputStart)) throw new NativeBatchBuildError('Original native input handler boundary is unavailable');
 /**
  Original input handling retains the same normalization and native dispatch behavior.
  */
 let input=source.slice(
   inputStart,
   inputEnd
 );
 input=replaceOnce({
   source:input,
   from:'    async emitInput(text, images, source, streamingBehavior) {',
   to:'export async function emitOwnedInput({runner,text,images,source,streamingBehavior,onInput}) {'
 });
 input=replaceOnce({
   source:input,
   from:'                try {\n                    const event = {',
   to:'                const event = {'
 });
 input=replaceOnce({
   source:input,
   from:'                    };\n                    const result = (await handler(event, ctx));',
   to:'                };\n                onInput(event);\n                try {\n                    const result = (await handler(event, ctx));'
 });
 input=input.replaceAll(
   'this.createContext()',
   'Reflect.apply(nativeCreateContext,runner,[])'
 )
   .replaceAll(
     'this.extensions',
     'runner.extensions'
   )
   .replaceAll(
     'this.emitError(',
     'runner.emitError('
   );
 return input;
}
/**
 Retain original context traversal with input copy and completion observations.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change
 */
function prepareContextEmitter(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({
   tag: prepareContextEmitter.name,
   l
 });
 rl.debug('preparing original native prompt source');
 /**
  The original context method begins native message transformation.
  */
 const contextStart=source.indexOf('    async emitContext(messages) {');
 /**
  The next provider callback ends the original context method.
  */
 const contextEnd=source.indexOf(
   '    async emitBeforeProviderRequest(',
   contextStart
 );
 if ((contextStart === (-1)) || (contextEnd <= contextStart)) throw new NativeBatchBuildError('Original native context handler boundary is unavailable');
 /**
  Original context transformations retain input, copy, and completion observations.
  */
 let context=source.slice(
   contextStart,
   contextEnd
 );
 context=replaceOnce({
   source:context,
   from:'    async emitContext(messages) {',
   to:'export async function emitOwnedContext({runner,messages,onClone}) {'
 });
 context=replaceOnce({
   source:context,
   from:'        let currentMessages = structuredClone(messages);',
   to:'        let currentMessages = structuredClone(messages);\n        const contextRun = onClone({kind:"request-context",before:messages,after:currentMessages});'
 });
 context=replaceOnce({
   source:context,
   from:'        return currentMessages;',
   to:'        onClone({kind:"completed-context",contextRun,messages:currentMessages});\n        return currentMessages;'
 });
 context=context.replaceAll(
   'this.createContext()',
   'Reflect.apply(nativeCreateContext,runner,[])'
 )
   .replaceAll(
     'this.extensions',
     'runner.extensions'
   )
   .replaceAll(
     'this.emitError(',
     'runner.emitError('
   );
 return context;
}
/**
 Compose captured original handler methods and their native helper imports.

 @param source - qualified original native extension runner source

 @param runnerUrl - original native runner module preserving its prototype methods

 @param promptUrl - original prompt formatter and normalization module

 @param aiUrl - captured native model message helpers

 @returns generated native handler module retaining original traversal and ownership

 @throws NativeBatchBuildError when original method or helper boundaries change

 @example
 ```ts
 const generated = promptEmitterSource({ source, runnerUrl, promptUrl, aiUrl });
 ```
 */
export function promptEmitterSource({
  source,
  runnerUrl,
  promptUrl,
  aiUrl
}: {
  readonly source: string;
  readonly runnerUrl: string;
  readonly promptUrl: string;
  readonly aiUrl: string
}): string {
 /**
  Handler module composition retains a distinct diagnostic boundary.
  */
 const rl=tagged({
   tag:promptEmitterSource.name,
   l
 });
 rl.debug('composing original native prompt handlers');
 /**
  The original snapshot helper begins retained native handler traversal.
  */
 const snapshotStart=source.indexOf('function snapshotEventHandlers(');
 /**
  The next original function ends the handler snapshot helper.
  */
 const snapshotEnd=source.indexOf(
   '\nfunction ',
   snapshotStart+1
 );
 /**
  Original message comparison helpers support the retained context traversal.
  */
 const helpersStart=source.indexOf('function sameMessages(');
 /**
  The original project-trust export ends the retained context helper block.
  */
 const helpersEnd=source.indexOf(
   'export async function emitProjectTrustEvent(',
   helpersStart
 );
 if ((snapshotStart === (-1)) || (snapshotEnd <= snapshotStart)
   || (helpersStart === (-1))
   || (helpersEnd <= helpersStart)) throw new NativeBatchBuildError('Original native handler helper boundaries are unavailable');
 /**
  Original context transformations retain input, copy, and completion observations.
  */
 const context=prepareContextEmitter(source);
 /**
  Original handler traversal remains ordered while its capture boundaries are installed.
  */
 const emitter=prepareBeforeAgentStartEmitter(source);
 /**
  Original input handling retains the same normalization and native dispatch behavior.
  */
 const input=prepareInputEmitter(source);
 return `import {getCurrentSystemMessage} from ${JSON.stringify(aiUrl)};\nimport {ExtensionRunner} from ${JSON.stringify(runnerUrl)};\nimport {buildSystemPrompt,normalizeBuildSystemPromptOptions} from ${JSON.stringify(promptUrl)};\nconst nativeCreateContext=ExtensionRunner.prototype.createContext,nativeAssertActive=ExtensionRunner.prototype.assertActive,nativeEmitError=ExtensionRunner.prototype.emitError;\n${source.slice(
   snapshotStart,
   snapshotEnd
 )}\n${source.slice(
   helpersStart,
   helpersEnd
 )}\n${context}\n${emitter}\n${input}`;
}

//endregion Qualified native source transformations retain original prompt and input owners
