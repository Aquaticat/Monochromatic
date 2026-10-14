import assert from 'node:assert/strict';
import {generate as protectManager} from '../../lifecycle/sdk-custody-native/generate.mjs';
import {generateSession} from '../../lifecycle/sdk-session-lifetime/generate.mjs';
import {generateCompletion} from '../../lifecycle/sdk-session-disposal-completion/generate.mjs';

function once({
  source,
  before,
  after
}){
 assert.equal(
   source.split(before)
     .length,
   2,
   `Current SDK root-owner edit: ${before}`
 );
 return source.replace(
   before,
   after
 );
}

/** Reuse the incumbent copy, private-field and native-occurrence mechanisms on current source. */
export function managerSource(source){
 const changes=[
  [
    '    _appendEntry(entry) {\n        this.fileEntries.push(entry);',
    '    _appendEntry(sourceEntry) {\n        const entry = structuredClone(sourceEntry);\n        this.#contextCopyObserver?.({before:[sourceEntry.type==="message"?sourceEntry.message:sourceEntry],after:[entry.type==="message"?entry.message:entry]});\n        this.#loadedInputs?.captureCreatedInput({entry,ordinal:this.fileEntries.length});\n        this.fileEntries.push(entry);'
  ],
  [
    '            this.fileEntries = entries;',
    '            this.fileEntries = structuredClone(entries);\n            this.#loadedInputs = captureLoadedInputs(this.fileEntries);'
  ],
  [
    '            this.fileEntries = this.fileEntries.concat(entries);',
    '            this.fileEntries = this.fileEntries.concat(structuredClone(entries));\n            this.#loadedInputs = captureLoadedInputs(this.fileEntries);'
  ],
  [
    '    getLeafEntry() {\n        return this.leafId ? this.byId.get(this.leafId) : undefined;\n    }',
    '    getLeafEntry() {\n        return structuredClone(this.leafId ? this.byId.get(this.leafId) : undefined);\n    }'
  ],
  [
    '    getEntry(id) {\n        return this.byId.get(id);\n    }',
    '    getEntry(id) {\n        return structuredClone(this.byId.get(id));\n    }'
  ],
  [
    '        return children;\n    }\n    /**\n     * Get the label',
    '        return structuredClone(children);\n    }\n    /**\n     * Get the label'
  ],
  [
    '        path.reverse();\n        return path;',
    '        path.reverse();\n        return structuredClone(path);'
  ],
  [
    '        return buildContextEntries(this.getEntries(), this.leafId, this.byId);',
    '        return structuredClone(buildContextEntries(this.getEntries(), this.leafId, this.byId));'
  ],
  [
    '        return buildSessionProjection(this.getEntries(), this.leafId, this.byId);',
    '        const original = buildSessionProjection(this.getEntries(), this.leafId, this.byId,path=>this.#contextCopyObserver?.({kind:"selected-path",rootOccurrence:SessionManager.rootOccurrenceOf(this),entries:path}));\n        this.#contextCopyObserver?.({kind:"projection",projection:original});\n        const copied = structuredClone(original);\n        this.#contextCopyObserver?.({before:original.messages,after:copied.messages});\n        return copied;'
  ],
  [
    '        return h ? h : null;',
    '        return h ? structuredClone(h) : null;'
  ],
  [
    '        return this.fileEntries.filter((e) => e.type !== "session");',
    '        const original = this.fileEntries.filter((e) => e.type !== "session");\n        const copied = structuredClone(original);\n        this.#contextCopyObserver?.({before:original.map(entry=>entry.type==="message"?entry.message:entry),after:copied.map(entry=>entry.type==="message"?entry.message:entry)});\n        return copied;'
  ]
 ];
 let value=source;
 value=once({
   source:value,
   before:'    appendMessage(message) {',
   after:'    appendMessage(message) {\n        if(!this.#contextCopyAttached)this.#loadedInputs.captureInitialManagerInput({frame:arguments,method:"appendMessage"});\n        else this.#loadedInputs.captureManagerInput({frame:arguments,method:"appendMessage"});'
 });
 value=once({
   source:value,
   before:'        this.leafId = entry.id;\n        this._persist(entry);',
   after:'        this.leafId = entry.id;\n        this.#contextCopyObserver?.({kind:"appended-entry",rootOccurrence:SessionManager.rootOccurrenceOf(this),entry});\n        this._persist(entry);'
 });
 value=once({
   source:value,
   before:'        return { ...message, content };',
   after:'        const projected = { ...message, content };\n        recordMessageInputProjection({before:edit,after:projected});\n        return projected;'
 });
 value=once({
   source:value,
   before:'        return [createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp)];',
   after:'        const summary = createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp);\n        recordMessageInputProjection({before:entry,after:summary});\n        return [summary];'
 });
 value=once({
   source:value,
   before:'        const summary = createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp);',
   after:'        const summary = createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp);\n        recordMessageInputProjection({before:entry,after:summary});'
 });
 value=once({
   source:value,
   before:'        this.fileEntries = [header];',
   after:'        this.#loadedInputs = captureLoadedInputs([]);\n        this.fileEntries = [header];'
 });
 value=once({
   source:value,
   before:'export function buildSessionProjection(entries, leafId, byId) {\n    const path = buildSessionPath(entries, leafId, byId);',
   after:'export function buildSessionProjection(entries, leafId, byId, observePath) {\n    const path = buildSessionPath(entries, leafId, byId);\n    observePath?.(path);'
 });
 value=once({
   source:value,
   before:'    appendCustomMessageEntry(customType, content, display, details) {',
   after:'    appendCustomMessageEntry(customType, content, display, details, originalMessage) {'
 });
 value=once({
   source:value,
   before:'        this._appendEntry(entry);\n        return entry.id;\n    }\n    /** Append a branch-local edit',
   after:'        if(originalMessage!==undefined)this.#contextCopyObserver?.({kind:"handler-entry",before:[originalMessage],after:[entry]});\n        this._appendEntry(entry);\n        return entry.id;\n    }\n    /** Append a branch-local edit'
 });
 for(const [before,after] of changes)value=once({
   source:value,
   before,
   after
 });
 const declarations=[
   'sessionId = ""',
   'sessionFile',
   'sessionDir',
   'cwd',
   'persist',
   'flushed = false',
   'fileEntries = []',
   'byId = new Map()',
   'labelsById = new Map()',
   'labelTimestampsById = new Map()',
   'leafId = null'
 ];
 const before=`export class SessionManager {\n${declarations.map(function emitPublicRootField(item) { return (`    ${item};\n`); })
   .join('')}`;
 const after=`export class SessionManager {\n    #loadedInputs;\n    #contextCopyObserver = observeMessageCopies;\n    #contextCopyAttached = false;\n    static {\n      attachContextCopies = (manager,observer) => { if(manager.#contextCopyAttached)throw new Error("Original manager already has a context-copy owner"); manager.#contextCopyAttached=true; manager.#contextCopyObserver=observer; };\n      readSessionInput = ({manager,publication}) => manager.#loadedInputs?.lookup(publication);\n      assertSessionInputs = manager => manager.#loadedInputs?.assertCaptured();\n      readConstructedInputs = manager => manager.#loadedInputs?.readConstructedInputs();\n      readInputUsage = manager => manager.#loadedInputs?.inputUsage();\n      captureQueuedInput = ({manager,...input}) => manager.#loadedInputs.captureQueuedInput(input);\n      captureCustomMessageInput = ({manager,message}) => manager.#loadedInputs.captureCustomMessageInput(message);\n      captureInputEvent = ({manager,event}) => manager.#loadedInputs.captureInputEvent(event);\n      captureUninterceptedInput = ({manager,...input}) => manager.#loadedInputs.captureUninterceptedInput(input);\n      captureTransformedInput = ({manager,...input}) => manager.#loadedInputs.captureTransformedInput(input);\n      captureCommandInput = ({manager,...input}) => manager.#loadedInputs.captureCommandInput(input);\n      captureCallInput = ({manager,...input}) => manager.#loadedInputs.captureCallInput(input);\n      captureAgentInput = ({manager,...input}) => manager.#loadedInputs.captureAgentInput(input);\n      captureCustomToolDescriptions = ({manager,...input}) => manager.#loadedInputs.captureCustomToolDescriptions(input);\n      bindHandlerResultOutput = manager => { const pool=manager.#loadedInputs; return frame=>pool.captureHandlerResultOutput({frame}); };\n      captureToolLoadoutOutput = ({manager,...input}) => manager.#loadedInputs.captureToolLoadoutOutput(input);\n      captureToolLoadoutInput = ({manager,...input}) => manager.#loadedInputs.captureToolLoadoutInput(input);\n      captureToolLoadoutQuery = ({manager,...input}) => manager.#loadedInputs.captureToolLoadoutQuery(input);\n    }\n${declarations.map(function emitPrivateRootField(item) { return (`    #${item};\n`); })
   .join('')}`;
 value=once({
   source:value,
   before,
   after
 });
 value=once({
   source:value,
   before:'attachContextCopies = (manager,observer) => { if(manager.#contextCopyAttached)throw new Error("Original manager already has a context-copy owner"); manager.#contextCopyAttached=true; manager.#contextCopyObserver=observer; };',
   after:`attachContextCopies = (manager,observer) => {
        if(manager.#contextCopyAttached)throw new Error("Original manager already has a context-copy owner");
        manager.#contextCopyAttached=true;
        manager.#contextCopyObserver=observer;
        let released=false;
        return () => {
          if(released)return;
          if(!manager.#contextCopyAttached||manager.#contextCopyObserver!==observer)throw new Error("Original manager context-copy binding changed before completed disposal");
          manager.#contextCopyAttached=false;
          manager.#contextCopyObserver=observeMessageCopies;
          released=true;
        };
      };`
 });
 for(const declaration of declarations){
  const field=declaration.split(' ')[0];
  value=value.replaceAll(
    new RegExp(
    String.raw`this\.`+field
      +String.raw`\b`,
    'g'
  ),
    `this.#${field}`
  );
 }
 const publicationUrl=new URL(
   '../../collector/run-prompt-custody-v3/handler-publication.mjs',
   import.meta.url
 ).href;
 const loadedUrl=new URL(
   '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
   import.meta.url
 ).href;
 const queryUrl=new URL(
   'loadout-query-observer.mjs',
   import.meta.url
 ).href;
 return `import {observeMessageCopies,recordMessageInputProjection} from ${JSON.stringify(publicationUrl)};\nimport {captureLoadedInputs} from ${JSON.stringify(loadedUrl)};\n`
  +`import {createLoadoutQueryObserver} from ${JSON.stringify(queryUrl)};\n`
   +`let attachContextCopies,readSessionInput,assertSessionInputs,readConstructedInputs,readInputUsage,captureQueuedInput,captureCustomMessageInput,captureInputEvent,captureUninterceptedInput,captureTransformedInput,captureCommandInput,captureCallInput,captureAgentInput,captureCustomToolDescriptions,bindHandlerResultOutput,captureToolLoadoutOutput,captureToolLoadoutInput,captureToolLoadoutQuery;\nexport function attachNativeContextCopies(manager,observer) { return attachContextCopies(manager,observer); }\n`
   +`export function readNativeSessionInputOrigin(input) { return readSessionInput(input); }\nexport function assertNativeSessionInputCapture(manager) { assertSessionInputs(manager); }\nexport function readNativeConstructedInputOrigins(manager) { return readConstructedInputs(manager); }\nexport function readNativeSessionInputUsage(manager) { return readInputUsage(manager); }\nexport function captureNativeQueuedInput(input) { captureQueuedInput(input); }\nexport function captureNativeCustomMessageInput(input) { captureCustomMessageInput(input); }\nexport function captureNativeInputEvent(input) { captureInputEvent(input); }\nexport function observeNativeUninterceptedInput(value) { captureUninterceptedInput(value); return value.input; }\nexport function observeNativeTransformedInput(value) { captureTransformedInput(value); return value.input; }\nexport function captureNativeCommandInput(value) { captureCommandInput(value); }\nexport function captureNativeCallInput(value) { captureCallInput(value); }\nexport function captureNativeAgentInput(value) { captureAgentInput(value); }\nexport function captureNativeCustomToolDescriptions(value) { captureCustomToolDescriptions(value); }\n`
   +`class NativeHandlerOutputObservationFailure extends Error { #failure; constructor(error) { super("Original handler output observation failed"); this.#failure=Object.freeze({error}); } static read(error) { return error!==null && typeof error==="object" && #failure in error ? error.#failure : undefined; } }\n`
   +`export function createNativeHandlerResultObserver(manager) { const capture=bindHandlerResultOutput(manager); return Object.freeze({ capture(output) { try { capture(arguments); } catch(error) { throw new NativeHandlerOutputObservationFailure(error); } }, failureFor(error) { return NativeHandlerOutputObservationFailure.read(error); }, rethrow(error) { const failure=NativeHandlerOutputObservationFailure.read(error); if(failure)throw failure.error; } }); }\n`
   +`export function createNativeToolLoadoutQueries(manager) { return createLoadoutQueryObserver({capture:frame=>captureToolLoadoutQuery({manager,frame,phase:"output"}),captureInput:frame=>captureToolLoadoutQuery({manager,frame,phase:"input"})}); }\n`
   +`export function captureNativeToolLoadoutInput({manager,input}) { captureToolLoadoutInput({manager,frame:arguments}); }\n`
   +`class NativeLoadoutObservationFailure extends Error { #original; constructor(error) { super("Original loadout output observation failed"); this.#original=error; } static rethrow(error) { if(error!==null && typeof error==="object" && #original in error)throw error.#original; } }\n`
   +`export function captureNativeToolLoadoutOutput({manager,output}) { try { captureToolLoadoutOutput({manager,frame:arguments}); } catch(error) { throw new NativeLoadoutObservationFailure(error); } }\n`
   +`export function rethrowNativeLoadoutObservation(error) { NativeLoadoutObservationFailure.rethrow(error); }\n${protectManager(value)}`;
}

/** Private liveness and disposal-completion readers remain separate from root occurrence. */
export function sessionSource(source){return generateCompletion(generateSession(source));}
