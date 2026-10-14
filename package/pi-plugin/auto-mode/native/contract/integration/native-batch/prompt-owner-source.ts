/**
 Preserve original native prompt-owner preparation and ownership boundaries.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { NativeBatchBuildError } from './build-entries.ts';

//region Qualified native source transformations retain original prompt and input owners

/**
 Native prompt-owner preparation retains a separate diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-prompt-owner-source' });

/**
 Bind native resource, context, prompt, and completed disposal owners to their original Session.

 @param source - qualified original native source before this preparation phase

 @returns source retaining original prompt and input ownership

 @throws NativeBatchBuildError when qualified original source boundaries change

 @example
 ```ts
 const generated = preparePromptOwners(source);
 ```
 */
export function preparePromptOwners(source: string): string {
 /**
  This transformation keeps its own source preparation diagnostic boundary.
  */
 const rl = tagged({
   tag: preparePromptOwners.name,
   l
 });
 rl.debug('preparing original native prompt source');
 /**
  Ordered transformations preserve the original native construction and handler sequence.
  */
 let value=source;
 value=replaceOnce({
   source:value,
   from:'let nativeDispose, readActiveManager, readDisposalState;',
   to:`let nativeDispose, readActiveManager, readDisposalState, readLoader, readPrompt, readBase, readRun, readConstructed, readInputUsage, readDomainEvents, nativePromptGetter, emitContext;
export function readActiveSessionResourceLoader(session) { return readLoader(session); }
export function readActiveSessionSystemPrompt(session) { return readPrompt(session); }
export function readActiveSessionBaseComposition(session) { return readBase(session); }
export function readActiveSessionRunComposition(session) { return readRun(session); }
export function readActiveSessionConstructedInputs(session) { return readConstructed(session); }
export function readActiveSessionInputUsage(session) { return readInputUsage(session); }
export function readActiveSessionDomainEvents(session) { return readDomainEvents(session); }
export function emitActiveSessionContext(input) { return emitContext(input); }`
 });
 value=replaceOnce({
   source:value,
   from:'    #resourceLoader;',
   to:`    #resourceLoader;
    #releaseContextCopies;
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
    });`
 });
 value=replaceOnce({
   source:value,
   from:'        nativeDispose = function () { return this.#disposeNative(); };',
   to:`        nativeDispose = function () { return this.#disposeNative(); };
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
            return emitOwnedContext({runner,messages,observer:createNativeContextObserver(session.#sessionManager),onClone:value=>session.#runPromptOwner.captureContextClone(value)});
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
            const registeredKinds=Object.freeze([...kinds].toSorted());
            return Object.freeze({kinds:registeredKinds,observation:readNativeRunnerDomainEvents({runner:session.#extensionRunner,kinds:registeredKinds})});
        };
        readInputUsage = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            return session.#runPromptOwner.readInputUsage(readNativeSessionInputUsage(session.#sessionManager));
        };
        readRun = session => {
            if(session.#custodyDisposed)throw new NativeSessionDisposedError();
            return session.#runPromptOwner.readOrAbsent({options:session.#runSystemPromptOptions});
        };`
 });
 value=replaceOnce({
   source:value,
   from:'        this.#resourceLoader = config.resourceLoader;',
   to:`        this.#resourceLoader = config.resourceLoader;
        this.#resourceInputBinding = config.resourceInputBinding;
        this.#releaseContextCopies=attachNativeContextCopies(this.sessionManager,value=>this.#runPromptOwner.captureContextClone(value));
        Object.defineProperty(this,"systemPrompt",{get:nativePromptGetter,configurable:false});`
 });
 value=replaceOnce({
   source:value,
   from:'            this.#custodyDisposalCompleted = this.#custodyDisposalDepth === 0 && completed;',
   to:`            const fullyDisposed=this.#custodyDisposalDepth===0&&completed;
            if(fullyDisposed)this.#releaseContextCopies?.();
            this.#custodyDisposalCompleted=fullyDisposed;`
 });
 value=replaceOnce({
   source:value,
   from:'        if (!this.#extensionRunner.hasHandlers("input")) {\n            return { text, images };\n        }',
   to:'        if (!this.#extensionRunner.hasHandlers("input")) {\n            return observeNativeUninterceptedInput({manager:this.#sessionManager,input:{text,images},source,streamingBehavior});\n        }'
 });
 value=replaceOnce({
   source:value,
   from:'await this.#extensionRunner.emitInput(text, images, source, streamingBehavior)',
   to:'await emitOwnedInput({runner:this.#extensionRunner,text,images,source,streamingBehavior,onInput:event=>captureNativeInputEvent({manager:this.#sessionManager,event})})'
 });
 value=replaceOnce({
   source:value,
   from:'            return { text: inputResult.text, images: inputResult.images ?? images };',
   to:'            return observeNativeTransformedInput({manager:this.#sessionManager,input:{text:inputResult.text,images:inputResult.images??images},source,streamingBehavior});'
 });
 value=replaceOnce({
   source:value,
   from:'        const ctx = this.#extensionRunner.createCommandContext();\n        try {',
   to:'        const ctx = this.#extensionRunner.createCommandContext();\n        captureNativeCommandInput({manager:this.#sessionManager,context:ctx,text,commandName});\n        try {'
 });
 return value;
}

//endregion Qualified native source transformations retain original prompt and input owners
