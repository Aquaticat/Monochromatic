import assert from 'node:assert/strict';

function once({source,before,after}){
 assert.equal(source.split(before).length,2,'Native prompt custody edit: '+before);
 return source.replace(before,after);
}

/** Port incumbent base/run custody transforms, not their historical staging manifests. */
export function promptSessionSource(source){
 let value=source;
 for(const [method,parameters] of [['prompt','text, options'],['steer','text, images, options'],['followUp','text, images, options']]){
  const entry='    async '+method+'('+parameters+') {\n';
  value=once({source:value,before:entry,after:entry+'        captureNativeCallInput({manager:this.#sessionManager,frame:arguments,method:'+JSON.stringify(method)+'});\n'});
 }
 value=once({source:value,before:'        if (options?.deliverAs === "nextTurn") {',after:'        captureNativeCustomMessageInput({manager:this.#sessionManager,message:appMessage});\n        if (options?.deliverAs === "nextTurn") {'});
 value=once({source:value,before:'this.#sessionManager.appendCustomMessageEntry(appMessage.customType, appMessage.content, appMessage.display, appMessage.details);',after:'this.#sessionManager.appendCustomMessageEntry(appMessage.customType, appMessage.content, appMessage.display, appMessage.details,appMessage);'});
 value=once({source:value,before:'        this.agent.steer({\n            role: "user",\n            content,\n            timestamp: Date.now(),\n        });',after:'        const message = {role:"user",content,timestamp:Date.now()};\n        captureNativeQueuedInput({manager:this.#sessionManager,message,text,delivery:"steer"});\n        this.agent.steer(message);'});
 value=once({source:value,before:'        this.agent.followUp({ role: "user", content, timestamp: Date.now() });',after:'        const message = {role:"user",content,timestamp:Date.now()};\n        captureNativeQueuedInput({manager:this.#sessionManager,message,text,delivery:"followUp"});\n        this.agent.followUp(message);'});
 for(const field of ['resourceLoader','baseSystemPromptOptions','runSystemPromptOptions','extensionRunner']){
  value=once({source:value,before:'    _'+field+';',after:'    #'+field+';'});
  value=value.replace(new RegExp('this\\._'+field+'\\b','g'),'this.#'+field);
 }
 value=once({source:value,before:'let nativeDispose, readActiveManager, readDisposalState;',after:`let nativeDispose, readActiveManager, readDisposalState, readLoader, readPrompt, readBase, readRun, readConstructed, readInputUsage, readDomainEvents, nativePromptGetter, emitContext;
export function readActiveSessionResourceLoader(session) { return readLoader(session); }
export function readActiveSessionSystemPrompt(session) { return readPrompt(session); }
export function readActiveSessionBaseComposition(session) { return readBase(session); }
export function readActiveSessionRunComposition(session) { return readRun(session); }
export function readActiveSessionConstructedInputs(session) { return readConstructed(session); }
export function readActiveSessionInputUsage(session) { return readInputUsage(session); }
export function readActiveSessionDomainEvents(session) { return readDomainEvents(session); }
export function emitActiveSessionContext(input) { return emitContext(input); }`});
 value=once({source:value,before:'    #resourceLoader;',after:`    #resourceLoader;
    #resourceInputBinding;
    #basePromptOwner = createBaseCompositionOwner();
    #runPromptOwner = createRunPromptOwner({
        requireRenderCapture:true,
        readRoot:()=>readRootOccurrence(this.#sessionManager),
        readSessionInput:publication=>readNativeSessionInputOrigin({manager:this.#sessionManager,publication}),
        readConstructedInputs:()=>readNativeConstructedInputOrigins(this.#sessionManager),
        assertSessionInputs:()=>assertNativeSessionInputCapture(this.#sessionManager),
        assertLive:()=>{if(this.#custodyDisposed)throw new NativeSessionDisposedError();},
        readBase:()=>this.#basePromptOwner.read({options:this.#baseSystemPromptOptions})
    });`});
 value=once({source:value,before:'        nativeDispose = function () { return this.#disposeNative(); };',after:`        nativeDispose = function () { return this.#disposeNative(); };
        readLoader = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            return session.#resourceLoader;
        };
        readPrompt = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            return Reflect.apply(nativePromptGetter,session,[]);
        };
        readBase = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            return session.#basePromptOwner.read({options:session.#baseSystemPromptOptions});
        };
        emitContext = ({session,runner,messages}) => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            if(runner!==session.#extensionRunner)throw new Error('Context emitter is not this original native runner');
            return emitOwnedContext({runner,messages,onClone:value=>session.#runPromptOwner.captureContextClone(value)});
        };
        readConstructed = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            assertNativeSessionInputCapture(session.#sessionManager);
            return session.#runPromptOwner.readInputOrigins(readNativeConstructedInputOrigins(session.#sessionManager));
        };
        readDomainEvents = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            const kinds = new Set();
            for(const extension of session.#extensionRunner.extensions){
                for(const [kind,handlers] of extension.handlers){
                    if(handlers.length && kind!=="before_agent_start")kinds.add(kind);
                }
            }
            return Object.freeze([...kinds].toSorted());
        };
        readInputUsage = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            return session.#runPromptOwner.readInputUsage(readNativeSessionInputUsage(session.#sessionManager));
        };
        readRun = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            return session.#runPromptOwner.readOrAbsent({options:session.#runSystemPromptOptions});
        };`});
 value=once({source:value,before:'        this.#resourceLoader = config.resourceLoader;',after:`        this.#resourceLoader = config.resourceLoader;
        this.#resourceInputBinding = config.resourceInputBinding;
        attachNativeContextCopies(this.sessionManager,value=>this.#runPromptOwner.captureContextClone(value));
        Object.defineProperty(this,"systemPrompt",{get:nativePromptGetter,configurable:false});`});
 value=once({source:value,before:'        if (!this.#extensionRunner.hasHandlers("input")) {\n            return { text, images };\n        }',after:'        if (!this.#extensionRunner.hasHandlers("input")) {\n            return observeNativeUninterceptedInput({manager:this.#sessionManager,input:{text,images},source,streamingBehavior});\n        }'});
 value=once({source:value,before:'await this.#extensionRunner.emitInput(text, images, source, streamingBehavior)',after:'await emitOwnedInput({runner:this.#extensionRunner,text,images,source,streamingBehavior,onInput:event=>captureNativeInputEvent({manager:this.#sessionManager,event})})'});
 value=once({source:value,before:'            return { text: inputResult.text, images: inputResult.images ?? images };',after:'            return observeNativeTransformedInput({manager:this.#sessionManager,input:{text:inputResult.text,images:inputResult.images??images},source,streamingBehavior});'});
 value=once({source:value,before:'        const ctx = this.#extensionRunner.createCommandContext();\n        try {',after:'        const ctx = this.#extensionRunner.createCommandContext();\n        captureNativeCommandInput({manager:this.#sessionManager,context:ctx,text,commandName});\n        try {'});
 const marker='    _rebuildSystemPrompt(toolNames) {',start=value.indexOf(marker),end=value.indexOf('\n    /**',start);
 assert(start>=0&&end>start);
 const block=value.slice(start,end),assignment='        this.#baseSystemPromptOptions = normalizeBuildSystemPromptOptions(',split=block.indexOf(assignment);
 assert(split>0);
 const prefix=block.slice(marker.length+1,split),tail=block.slice(split+assignment.length);
 assert(tail.endsWith(');\n    }'));
 const input=tail.slice(0,-');\n    }'.length);
 value=value.slice(0,start)+`    _rebuildSystemPrompt(toolNames) { return this.#rebuildSystemPrompt(toolNames); }
    #rebuildSystemPrompt(toolNames) {
        this.#baseSystemPromptOptions = this.#basePromptOwner.build({
            binding:this.#resourceInputBinding,loader:this.#resourceLoader,normalize:normalizeBuildSystemPromptOptions,
            read:()=>{
`+prefix+'        const input = '+input+`;
        return {input,resources:{contextFiles:loadedContextFiles,systemPrompt:loaderSystemPrompt,appendSystemPrompt:loaderAppendSystemPrompt}};
            }
        });
    }`+value.slice(end);
 value=value.replaceAll('this._rebuildSystemPrompt(','this.#rebuildSystemPrompt(');
 value=once({source:value,before:'getSystemPromptOptions: () => this.#baseSystemPromptOptions,',after:'getSystemPromptOptions: () => copyPromptOptions(this.#baseSystemPromptOptions),'});
 value=once({source:value,before:'            this.#runSystemPromptOptions = undefined;',after:'            this.#runSystemPromptOptions = undefined;\n            this.#runPromptOwner.reset();'});
 const refreshStart=value.indexOf('            const runOptions = this.#runSystemPromptOptions ?? this.#baseSystemPromptOptions;');
 const refreshEnd=value.indexOf('            return {',refreshStart);
 assert(refreshStart>=0&&refreshEnd>refreshStart);
 let refresh=value.slice(refreshStart,refreshEnd);
 refresh=once({source:refresh,before:'const runOptions = this.#runSystemPromptOptions ?? this.#baseSystemPromptOptions;',after:'const runOptions = previous ?? base;'});
 refresh=refresh.replaceAll('this.#baseSystemPromptOptions.toolSnippets','base.toolSnippets').replaceAll('this.#baseSystemPromptOptions.toolGuidelines','base.toolGuidelines');
 refresh=once({source:refresh,before:'            const updateMessage =',after:'            updateMessage ='});
 refresh=once({source:refresh,before:'            this.#runSystemPromptOptions = options;',after:'            return options;'});
 value=value.slice(0,refreshStart)+'            let updateMessage;\n            this.#runSystemPromptOptions = this.#runPromptOwner.refresh({previousOptions:this.#runSystemPromptOptions,compose:({previous,base})=>{\n'+refresh+'            }});\n'+value.slice(refreshEnd);
 // Pi 1.2 prepares a typed run trigger; Pi 1.1 prepares the expanded prompt directly.
 const hasRunTrigger = source.includes('    async _prepareRun(trigger) {');
 if (hasRunTrigger) {
 value=once({source:value,before:'        const selectedToolsBefore = this.#baseSystemPromptOptions.selectedTools;\n        const result = await this.#extensionRunner.emitBeforeAgentStart(trigger, this.#baseSystemPromptOptions);',after:`        const run = this.#runPromptOwner.start({runner:this.#extensionRunner,expandedPrompt:trigger.messageType==="user"?trigger.prompt:undefined});
        const outputObserver = createNativeHandlerResultObserver(this.#sessionManager);
        const messages = [];
        try {
        const selectedToolsBefore = run.seed.selectedTools;
        const result = await emitOwnedBeforeAgentStart({runner:this.#extensionRunner,owner:this.#runPromptOwner,scope:run.handle,trigger,seed:run.seed,outputObserver});`});
 value=once({source:value,before:'        const messages = [];\n        if (trigger.messageType === "custom") {',after:'        if (trigger.messageType === "custom") {'});
 value=once({source:value,before:'        this.#runSystemPromptOptions = result.systemPromptOptions;',after:'        this.#runSystemPromptOptions = this.#runPromptOwner.publish({scope:run.handle,result});'});
 value=once({source:value,before:'            messages.push({\n                role: "user",\n                content: [{ type: "text", text }, ...normalized.images],\n                timestamp: Date.now(),\n            });',after:'            const userMessage = {role:"user",content:[{type:"text",text},...normalized.images],timestamp:Date.now()};\n            this.#runPromptOwner.captureExpandedPromptMessage({scope:run.handle,expandedPrompt:trigger.prompt,message:userMessage});\n            messages.push(userMessage);'});
 } else {
 value=once({source:value,before:'        const selectedToolsBefore = this.#baseSystemPromptOptions.selectedTools;\n        const result = await this.#extensionRunner.emitBeforeAgentStart(expandedText, currentImages, this.#baseSystemPromptOptions);',after:`        const run = this.#runPromptOwner.start({runner:this.#extensionRunner,expandedPrompt:expandedText});
        const outputObserver = createNativeHandlerResultObserver(this.#sessionManager);
        const messages = [];
        try {
        const selectedToolsBefore = run.seed.selectedTools;
        const result = await emitOwnedBeforeAgentStart({runner:this.#extensionRunner,owner:this.#runPromptOwner,scope:run.handle,prompt:expandedText,images:currentImages,seed:run.seed,outputObserver});`});
 value=once({source:value,before:'        // Build messages only after hooks and image normalization have completed.\n        const messages = [];',after:'        // Build messages only after hooks and image normalization have completed.'});
 value=once({source:value,before:'        this.#runSystemPromptOptions = result.systemPromptOptions;',after:'        this.#runSystemPromptOptions = this.#runPromptOwner.publish({scope:run.handle,result});'});
 value=once({source:value,before:'        messages.push({\n            role: "user",\n            content: userContent,\n            timestamp: Date.now(),\n        });',after:'        const userMessage = {role:"user",content:userContent,timestamp:Date.now()};\n        this.#runPromptOwner.captureExpandedPromptMessage({scope:run.handle,expandedPrompt:expandedText,message:userMessage});\n        messages.push(userMessage);'});
 }
 value=once({source:value,before:'        for (const msg of result.messages) {\n            messages.push({',after:'        for (const msg of result.messages) {\n            const message = {'});
 value=once({source:value,before:'                timestamp: Date.now(),\n            });\n        }\n        const updateMessage =',after:'                timestamp: Date.now(),\n            };\n            this.#runPromptOwner.captureHandlerMessage({result,input:msg,message});\n            messages.push(message);\n        }\n        const updateMessage ='});
 value=once({source:value,before:'this.#sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details);',after:'this.#sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details,event.message);'});
 if (hasRunTrigger) {
 value=once({source:value,before:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        return messages;',after:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        } catch(error) { const failure = this.#runPromptOwner.fail({scope:run.handle,error}); outputObserver.rethrow(error); throw failure; }\n        return messages;'});
 } else {
 value=once({source:value,before:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        preflightResult?.("started");',after:'        if (updateMessage)\n            messages.unshift(updateMessage);\n        } catch(error) { const failure = this.#runPromptOwner.fail({scope:run.handle,error}); outputObserver.rethrow(error); throw failure; }\n        preflightResult?.("started");'});
 }
 value=once({source:value,before:'    _preparePromptAndToolLoadout(options, messages = this.agent.state.messages) {',after:'    #preparePromptAndToolLoadout(options, messages = this.agent.state.messages) {'});
 value=value.replaceAll('this._preparePromptAndToolLoadout(','this.#preparePromptAndToolLoadout(');
 value=once({source:value,before:'            return [head, ...transformed.filter((message) => message.role !== "system")];',after:'            this.#runPromptOwner.captureForcedMessage({options:this.#runSystemPromptOptions,message:head});\n            return [head, ...transformed.filter((message) => message.role !== "system")];'});
 value=once({source:value,before:'buildSystemPromptSections(options)',after:'this.#runPromptOwner.render({options,build:buildOwnedSystemPromptSections})'});
 value=once({source:value,before:'        return sections ? { role: "system", content: "", sections, timestamp: Date.now() } : undefined;',after:'        const message = sections ? { role: "system", content: "", sections, timestamp: Date.now() } : undefined;\n        this.#runPromptOwner.captureSystemMessage({options,message});\n        return message;'});
 return value+'\nnativePromptGetter = Object.getOwnPropertyDescriptor(AgentSession.prototype,"systemPrompt").get;\n';
}

/** Capture the actual current native handler traversal through the incumbent run owner. */
export function promptEmitterSource({source,runnerUrl,promptUrl,aiUrl}){
 const snapshotStart=source.indexOf('function snapshotEventHandlers('),snapshotEnd=source.indexOf('\nfunction ',snapshotStart+1);
 const methodStart=source.indexOf('    async emitBeforeAgentStart('),methodEnd=source.indexOf('    async emitResourcesDiscover(',methodStart);
 assert(snapshotStart>=0&&snapshotEnd>snapshotStart&&methodStart>=0&&methodEnd>methodStart);
 let emitter=source.slice(methodStart,methodEnd);
 const edits=[
  source.includes('    async emitBeforeAgentStart(trigger,')
   ? ['    async emitBeforeAgentStart(trigger, systemPromptOptions) {','export async function emitOwnedBeforeAgentStart({runner,owner,scope,trigger,seed:systemPromptOptions,outputObserver}) {']
   : ['    async emitBeforeAgentStart(prompt, images, systemPromptOptions) {','export async function emitOwnedBeforeAgentStart({runner,owner,scope,prompt,images,seed:systemPromptOptions,outputObserver}) {'],
  ['this.createContext()','Reflect.apply(nativeCreateContext,runner,[])'],
  ['this.assertActive();','Reflect.apply(nativeAssertActive,runner,[]);'],
  ['        for (const { ext, handlers } of snapshotEventHandlers(this.extensions, "before_agent_start")) {','        const snapshot = snapshotEventHandlers(runner.extensions, "before_agent_start");\n        owner.enterNative({scope,runner,seed:systemPromptOptions,working:currentOptions,snapshot,messages});\n        for (const { ext, handlers } of snapshot) {'],
  ['                try {','                await owner.invokeHandler({scope,runner,extension:ext,handler,messages,outputObserver,invoke:async()=>{'],
  ['                    const handlerResult = await handler(event, ctx);','                    const handlerResult = await handler(event, ctx);\n                    outputObserver.capture(handlerResult);'],
  ['                }\n                catch (err) {','                },reportError:(err)=>{'],
  ['                    this.emitError({','                    Reflect.apply(nativeEmitError,runner,[{'],
  ['                        stack,\n                    });\n                }','                        stack,\n                    }]);\n                }});'],
  ['        return { messages, systemPromptOptions: currentOptions };','        return owner.leaveNative({scope,runner,working:currentOptions,messages});']
 ];
 for(const [before,after] of edits)emitter=once({source:emitter,before,after});
 const inputStart=source.indexOf('    async emitInput('),inputEnd=source.indexOf('\n}\n',inputStart);
 assert(inputStart>=0&&inputEnd>inputStart);
 let input=source.slice(inputStart,inputEnd);
 input=once({source:input,before:'    async emitInput(text, images, source, streamingBehavior) {',after:'export async function emitOwnedInput({runner,text,images,source,streamingBehavior,onInput}) {'});
 input=once({source:input,before:'                try {\n                    const event = {',after:'                const event = {'});
 input=once({source:input,before:'                    };\n                    const result = (await handler(event, ctx));',after:'                };\n                onInput(event);\n                try {\n                    const result = (await handler(event, ctx));'});
 input=input.replaceAll('this.createContext()','Reflect.apply(nativeCreateContext,runner,[])').replaceAll('this.extensions','runner.extensions').replaceAll('this.emitError(', 'runner.emitError(');
 const contextStart=source.indexOf('    async emitContext(messages) {'),contextEnd=source.indexOf('    async emitBeforeProviderRequest(',contextStart);
 const helpersStart=source.indexOf('function sameMessages('),helpersEnd=source.indexOf('export async function emitProjectTrustEvent(',helpersStart);
 assert(contextStart>=0&&contextEnd>contextStart&&helpersStart>=0&&helpersEnd>helpersStart);
 let context=source.slice(contextStart,contextEnd);
 context=once({source:context,before:'    async emitContext(messages) {',after:'export async function emitOwnedContext({runner,messages,onClone}) {'});
 context=once({source:context,before:'        let currentMessages = structuredClone(messages);',after:'        let currentMessages = structuredClone(messages);\n        const contextRun = onClone({kind:"request-context",before:messages,after:currentMessages});'});
 context=once({source:context,before:'        return currentMessages;',after:'        onClone({kind:"completed-context",contextRun,messages:currentMessages});\n        return currentMessages;'});
 context=context.replaceAll('this.createContext()','Reflect.apply(nativeCreateContext,runner,[])').replaceAll('this.extensions','runner.extensions').replaceAll('this.emitError(', 'runner.emitError(');
 return 'import {getCurrentSystemMessage} from '+JSON.stringify(aiUrl)+';\n'+'import {ExtensionRunner} from '+JSON.stringify(runnerUrl)+';\nimport {buildSystemPrompt,normalizeBuildSystemPromptOptions} from '+JSON.stringify(promptUrl)+';\nconst nativeCreateContext=ExtensionRunner.prototype.createContext,nativeAssertActive=ExtensionRunner.prototype.assertActive,nativeEmitError=ExtensionRunner.prototype.emitError;\n'+source.slice(snapshotStart,snapshotEnd)+'\n'+source.slice(helpersStart,helpersEnd)+'\n'+context+'\n'+emitter+'\n'+input;
}
