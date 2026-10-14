/**
 Retain original extension callback awaits while observing complete event values.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { parse } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';
import { replaceOnce } from './build-rebase.ts';
import { applyNativeSourceEdits, type NativeSourceEdit } from './build-spans.ts';

//region Qualified original methods preserve native branching, ordering, and caught values

/** Source preparation retains its own diagnostic boundary. */
const l=tagged({tag:'auto-mode-native-event-runner-source'});
/** These original methods cover the configured generic, boundary, message, and tool events. */
const methods=Object.freeze(['emitBoundary','emit','emitMessageEnd','emitToolResult','emitToolCall','emitUserBash'] as const);
/** Original method membership narrows later source templates. */
type NativeObservedMethod=typeof methods[number];

/**
 Narrow parsed method names through the fixed native dispatch profile.

 @param name - decoded original method identifier
 @returns whether the source profile contains this original method
 */
function isObservedMethod(name: string): name is NativeObservedMethod {
  return methods.some(function matchesMethod(method){return method===name;});
}

/**
 Insert synchronous capture at original callback and native return boundaries.

 @param name - original method selected from the parsed ExtensionRunner declaration
 @param body - exact original method body without its outer braces
 @returns body preserving original callback awaits and native error handling
 @throws NativeBatchBuildError when an expected native dispatch site differs
 */
function observedMethod({name,body}: {readonly name:NativeObservedMethod;readonly body:string}): string {
  /** Method-level diagnostics retain the source generator's tag. */
  const rl=tagged({tag:observedMethod.name,l});
  rl.debug(`observing original native method ${name}`);
  /** Boundary events name their kind before constructing per-handler inputs. */
  const kind=name==='emitBoundary'?'baseEvent.type':name==='emit'?'event.type':JSON.stringify({emitMessageEnd:'message_end',emitToolResult:'tool_result',emitToolCall:'tool_call',emitUserBash:'user_bash'}[name]);
  /** Tool-call traversal originally omits the extension binding although its snapshot retains it. */
  const originalBindings=name==='emitToolCall'?'handlers':'ext, handlers';
  /** Snapshot creation remains at its original native position. */
  let value=replaceOnce({source:body,
    from:`        for (const { ${originalBindings} } of snapshotEventHandlers(this.extensions, ${kind})) {`,
    to:`        const nativeEventSnapshot = snapshotEventHandlers(this.extensions, ${kind});
        const nativeEventObservation = this.#nativeEventObserver.begin({kind:${kind},snapshot:nativeEventSnapshot});
        try {
        for (const { ext, handlers } of nativeEventSnapshot) {`
  });
  /** Message and tool-result handlers consume the native evolving event record. */
  const input=name==='emitMessageEnd'||name==='emitToolResult'?'currentEvent':'event';
  /** The original source retains its parentheses and its one existing await. */
  const call=name==='emit'||name==='emitToolCall'||name==='emitUserBash'
    ?`                    const handlerResult = await handler(${input}, ctx);`
    :`                    const handlerResult = (await handler(${input}, ctx));`;
  /** Tool-call's unhandled native await has one less indentation level. */
  const originalCall=name==='emitToolCall'?call.slice(4):call;
  value=replaceOnce({source:value,from:originalCall,to:`                    nativeEventObservation.before({extension:ext,handler,event:${input}});
${originalCall}
                    nativeEventObservation.returned(handlerResult);`});
  /** Original catch count rejects a changed native method shape before editing. */
  const catches=name==='emitBoundary'?2:name==='emitToolCall'?0:1;
  /** Native caught values retain their original emitter and error reporting. */
  const catchSite='                catch (err) {';
  if(value.split(catchSite).length!==catches+1)
    throw new NativeBatchBuildError(`Original native event catches changed: ${name}`);
  value=value.replaceAll(catchSite,`${catchSite}\n                    nativeEventObservation.failed(err);`);
  if(name==='emit'||name==='emitToolCall') {
    /** Only the original cancel/block branch can stop before the remaining callbacks. */
    const earlyReturn=name==='emit'?'                            return result;':'                        return result;';
    value=replaceOnce({source:value,from:earlyReturn,to:`                        nativeEventObservation.stopped();\n${earlyReturn}`});
  }
  if(name==='emitUserBash')value=replaceOnce({source:value,
    from:'                    return handlerResult;',
    to:'                    nativeEventObservation.stopped();\n                    return handlerResult;'
  });
  /** Completion precedes the original tail, including both tool-result return branches. */
  const tail={
    emitBoundary:'        return valid',
    emit:'        return result;',
    emitMessageEnd:'        return modified ? currentMessage : undefined;',
    emitToolResult:'        if (!modified) {',
    emitToolCall:'        return result;',
    emitUserBash:'        return undefined;'
  }[name];
  value=replaceOnce({source:value,from:`\n${tail}`,to:`\n        nativeEventObservation.end();\n${tail}`});
  return `${value}\n        } catch (nativeEventError) {
            nativeEventObservation.aborted(nativeEventError);
            throw nativeEventError;
        }\n`;
}

/**
 Instrument parsed original native runner methods and retain a private per-runner observer.

 @param source - qualified original ExtensionRunner module
 @returns generated module using original callback identity and manager capture
 @throws NativeBatchBuildError when original methods or constructor sites differ
 @example
 ```ts
 const generated=eventRunnerSource(originalRunner);
 ```
 */
export function eventRunnerSource(source: string): string {
  /** Composition diagnostics retain their function boundary. */
  const rl=tagged({tag:eventRunnerSource.name,l});
  rl.debug('preparing original native event runner');
  /** Parsed class membership excludes matching text in comments, strings, and other classes. */
  const parsed=parse(source,{sourceType:'module'});
  if(parsed.diagnostics.length>0)throw new NativeBatchBuildError('Cannot parse original native event runner');
  /** The exact original exported class supplies method source coordinates. */
  const candidates=parsed.program.body.filter(function originalClass(node){return node.type==='ExportNamedDeclaration'&&node.declaration?.type==='ClassDeclaration'&&node.declaration.id?.name==='ExtensionRunner';});
  /** Narrow the original declaration without widening its parser node type. */
  const [exported]=candidates;
  if(candidates.length!==1||exported?.type!=='ExportNamedDeclaration'||exported.declaration?.type!=='ClassDeclaration')
    throw new NativeBatchBuildError('Original native ExtensionRunner declaration is unavailable');
  /** Original source order preserves disjoint method body replacements. */
  const edits: NativeSourceEdit[]=[];
  /** Every selected method must occur once in that original class. */
  const seen=new Set<string>();
  for(const node of exported.declaration.body.body) {
    if(node.type!=='MethodDefinition'||node.computed||node.key.type!=='Identifier'||!isObservedMethod(node.key.name))continue;
    /** Method name and body are narrowed from the original parsed class member. */
    const name=node.key.name;
    if(seen.has(name)||node.value.body?.type!=='BlockStatement')
      throw new NativeBatchBuildError(`Original native event method differs: ${name}`);
    seen.add(name);
    edits.push({start:node.value.body.start+1,end:node.value.body.end-1,text:observedMethod({name,body:source.slice(node.value.body.start+1,node.value.body.end-1)})});
  }
  if(seen.size!==methods.length)throw new NativeBatchBuildError('Original native event method membership changed');
  /** Original constructor and reader identities remain in the same generated class. */
  let value=applyNativeSourceEdits({source,edits});
  value=replaceOnce({source:value,from:'export class ExtensionRunner {',to:`let readNativeEventDomain;
export function readNativeRunnerDomainEvents({runner,kinds}) { return readNativeEventDomain(runner,kinds); }
export class ExtensionRunner {
    #nativeEventObserver;
    static { readNativeEventDomain=(runner,kinds)=>runner.#nativeEventObserver.read(kinds); }`});
  value=replaceOnce({source:value,from:'        this.sessionManager = sessionManager;',to:'        this.sessionManager = sessionManager;\n        this.#nativeEventObserver = createNativeEventObserver(sessionManager);'});
  return `import {createNativeEventObserver} from "./session-manager.mjs";\n${value}`;
}

//endregion Qualified original methods preserve native branching, ordering, and caught values
