/**
 Preserve original native prompt-run preparation and ownership boundaries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { NativeBatchBuildError } from './build-entries.ts';
import { privatizeNativeMembers } from './build-members.ts';

//region Qualified native source transformations retain original prompt and input owners

/**
 Native prompt-run preparation retains a separate diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-prompt-run-source' });

/**
 Retain native trigger variants, original handler outputs, and prompt render occurrences.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change

 @example
 ```ts
 const generated = preparePromptRun(source);
 ```
 */
export function preparePromptRun(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({ tag: preparePromptRun.name, l });
 rl.debug('preparing original native prompt source');
 /**
  Ordered transformations preserve the original native construction and handler sequence.
  */
 let value=source;
 // Pi 1.2 prepares a typed run trigger; Pi 1.1 prepares the expanded prompt directly.
 /**
  The original SDK entry shape distinguishes typed run triggers from expanded prompt input.
  */
 const hasRunTrigger = source.includes('    async _prepareRun(trigger) {');
 if (hasRunTrigger) {
 value=replaceOnce({
   source:value,
   from:'        const selectedToolsBefore = this.#baseSystemPromptOptions.selectedTools;\n        const result = await this.#extensionRunner.emitBeforeAgentStart(trigger, this.#baseSystemPromptOptions);',
   to:`        const run = this.#runPromptOwner.start({runner:this.#extensionRunner,expandedPrompt:trigger.messageType==="user"?trigger.prompt:undefined});
        const outputObserver = createNativeHandlerResultObserver(this.#sessionManager);
        const messages = [];
        try {
        const selectedToolsBefore = run.seed.selectedTools;
        const result = await emitOwnedBeforeAgentStart({runner:this.#extensionRunner,owner:this.#runPromptOwner,scope:run.handle,trigger,seed:run.seed,outputObserver});`
 });
 value=replaceOnce({
   source:value,
   from:'        const messages = [];\n        if (trigger.messageType === "custom") {',
   to:'        if (trigger.messageType === "custom") {'
 });
 value=replaceOnce({
   source:value,
   from:'        this.#runSystemPromptOptions = result.systemPromptOptions;',
   to:'        this.#runSystemPromptOptions = this.#runPromptOwner.publish({scope:run.handle,result});'
 });
 value=replaceOnce({
   source:value,
   from:'            messages.push({\n                role: "user",\n                content: [{ type: "text", text }, ...normalized.images],\n                timestamp: Date.now(),\n            });',
   to:'            const userMessage = {role:"user",content:[{type:"text",text},...normalized.images],timestamp:Date.now()};\n            this.#runPromptOwner.captureExpandedPromptMessage({scope:run.handle,expandedPrompt:trigger.prompt,message:userMessage});\n            messages.push(userMessage);'
 });
 } else {
 value=replaceOnce({
   source:value,
   from:'        const selectedToolsBefore = this.#baseSystemPromptOptions.selectedTools;\n        const result = await this.#extensionRunner.emitBeforeAgentStart(expandedText, currentImages, this.#baseSystemPromptOptions);',
   to:`        const run = this.#runPromptOwner.start({runner:this.#extensionRunner,expandedPrompt:expandedText});
        const outputObserver = createNativeHandlerResultObserver(this.#sessionManager);
        const messages = [];
        try {
        const selectedToolsBefore = run.seed.selectedTools;
        const result = await emitOwnedBeforeAgentStart({runner:this.#extensionRunner,owner:this.#runPromptOwner,scope:run.handle,prompt:expandedText,images:currentImages,seed:run.seed,outputObserver});`
 });
 value=replaceOnce({
   source:value,
   from:'        // Build messages only after hooks and image normalization have completed.\n        const messages = [];',
   to:'        // Build messages only after hooks and image normalization have completed.'
 });
 value=replaceOnce({
   source:value,
   from:'        this.#runSystemPromptOptions = result.systemPromptOptions;',
   to:'        this.#runSystemPromptOptions = this.#runPromptOwner.publish({scope:run.handle,result});'
 });
 value=replaceOnce({
   source:value,
   from:'        messages.push({\n            role: "user",\n            content: userContent,\n            timestamp: Date.now(),\n        });',
   to:'        const userMessage = {role:"user",content:userContent,timestamp:Date.now()};\n        this.#runPromptOwner.captureExpandedPromptMessage({scope:run.handle,expandedPrompt:expandedText,message:userMessage});\n        messages.push(userMessage);'
 });
 }
 value=replaceOnce({
   source:value,
   from:'        for (const msg of result.messages) {\n            messages.push({',
   to:'        for (const msg of result.messages) {\n            const message = {'
 });
 value=replaceOnce({
   source:value,
   from:'                timestamp: Date.now(),\n            });\n        }\n        const updateMessage =',
   to:'                timestamp: Date.now(),\n            };\n            this.#runPromptOwner.captureHandlerMessage({result,input:msg,message});\n            messages.push(message);\n        }\n        const updateMessage ='
 });
 value=replaceOnce({
   source:value,
   from:'this.#sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details);',
   to:'this.#sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details,event.message);'
 });
 if (hasRunTrigger) {
 value=replaceOnce({
   source:value,
   from:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        return messages;',
   to:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        } catch(error) { const failure = this.#runPromptOwner.fail({scope:run.handle,error}); outputObserver.rethrow(error); throw failure; }\n        return messages;'
 });
 } else {
 value=replaceOnce({
   source:value,
   from:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        preflightResult?.("started");',
   to:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        } catch(error) { const failure = this.#runPromptOwner.fail({scope:run.handle,error}); outputObserver.rethrow(error); throw failure; }\n        preflightResult?.("started");'
 });
 }
 value=replaceOnce({
   source:value,
   from:'    _preparePromptAndToolLoadout(options, messages = this.agent.state.messages) {',
   to:'    #preparePromptAndToolLoadout(options, messages = this.agent.state.messages) {'
 });
 value=privatizeNativeMembers({source:value,members:['_preparePromptAndToolLoadout'],renames:{_preparePromptAndToolLoadout:'preparePromptAndToolLoadout'}});
 value=replaceOnce({
   source:value,
   from:'            return [head, ...transformed.filter((message) => message.role !== "system")];',
   to:'            this.#runPromptOwner.captureForcedMessage({options:this.#runSystemPromptOptions,message:head});\n            return [head, ...transformed.filter((message) => message.role !== "system")];'
 });
 value=replaceOnce({
   source:value,
   from:'buildSystemPromptSections(options)',
   to:'this.#runPromptOwner.render({options,build:buildOwnedSystemPromptSections})'
 });
 value=replaceOnce({
   source:value,
   from:'        return sections ? { role: "system", content: "", sections, timestamp: Date.now() } : undefined;',
   to:'        const message = sections ? { role: "system", content: "", sections, timestamp: Date.now() } : undefined;\n        this.#runPromptOwner.captureSystemMessage({options,message});\n        return message;'
 });
 return value;
}

//endregion Qualified native source transformations retain original prompt and input owners
