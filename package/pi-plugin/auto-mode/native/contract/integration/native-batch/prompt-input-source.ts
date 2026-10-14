/**
 Preserve original native prompt-input preparation and ownership boundaries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { NativeBatchBuildError } from './build-entries.ts';
import { privatizeNativeMembers } from './build-members.ts';

//region Qualified native source transformations retain original prompt and input owners

/**
 Native prompt-input preparation retains a separate diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-prompt-input-source' });

/**
 Bind original native call, custom message, and queued input occurrences before prompt composition.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change

 @example
 ```ts
 const generated = preparePromptInputs(source);
 ```
 */
export function preparePromptInputs(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({ tag: preparePromptInputs.name, l });
 rl.debug('preparing original native prompt source');

 /**
  Ordered transformations preserve the original native construction and handler sequence.
  */
 let value=source;
 for(const [method,parameters] of [
   [
     'prompt',
     'text, options'
   ],
   [
     'steer',
     'text, images, options'
   ],
   [
     'followUp',
     'text, images, options'
   ]
 ] as const){
  /**
  The exact original method signature selects one invocation capture site.
  */
 const entry=`    async ${method}(${parameters}) {\n`;
  value=replaceOnce({
    source:value,
    from:entry,
    to:`${entry}        captureNativeCallInput({manager:this.#sessionManager,frame:arguments,method:${
      JSON.stringify(method)
      }});\n`
  });
 }
 value=replaceOnce({
   source:value,
   from:'        if (options?.deliverAs === "nextTurn") {',
   to:'        captureNativeCustomMessageInput({manager:this.#sessionManager,message:appMessage});\n        if (options?.deliverAs === "nextTurn") {'
 });
 value=replaceOnce({
   source:value,
   from:'this.#sessionManager.appendCustomMessageEntry(appMessage.customType, appMessage.content, appMessage.display, appMessage.details);',
   to:'this.#sessionManager.appendCustomMessageEntry(appMessage.customType, appMessage.content, appMessage.display, appMessage.details,appMessage);'
 });
 value=replaceOnce({
   source:value,
   from:'        this.agent.steer({\n            role: "user",\n            content,\n            timestamp: Date.now(),\n        });',
   to:'        const message = {role:"user",content,timestamp:Date.now()};\n        captureNativeQueuedInput({manager:this.#sessionManager,message,text,delivery:"steer"});\n        this.agent.steer(message);'
 });
 value=replaceOnce({
   source:value,
   from:'        this.agent.followUp({ role: "user", content, timestamp: Date.now() });',
   to:'        const message = {role:"user",content,timestamp:Date.now()};\n        captureNativeQueuedInput({manager:this.#sessionManager,message,text,delivery:"followUp"});\n        this.agent.followUp(message);'
 });
 for(const field of [
   'resourceLoader',
   'baseSystemPromptOptions',
   'runSystemPromptOptions',
   'extensionRunner'
 ]){
  value=replaceOnce({
    source:value,
    from:`    _${field};`,
    to:`    #${field};`
  });
 }
 value=privatizeNativeMembers({source:value,members:['_resourceLoader','_baseSystemPromptOptions','_runSystemPromptOptions','_extensionRunner'],renames:{_resourceLoader:'resourceLoader',_baseSystemPromptOptions:'baseSystemPromptOptions',_runSystemPromptOptions:'runSystemPromptOptions',_extensionRunner:'extensionRunner'}});
 return value;
}

//endregion Qualified native source transformations retain original prompt and input owners
