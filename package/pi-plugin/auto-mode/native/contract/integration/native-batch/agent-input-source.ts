/**
 Observe original Agent input frames without changing borrowed constructor options.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';

//region Original Agent methods retain argument frames before native processing

/**
 Input source transformations retain their own diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-agent-input-source' });

/**
 Observe an original message method without rewriting its native processing.

 @param source - qualified Agent source containing the original method

 @param method - native method whose input frame is retained

 @returns source capturing the original method arguments before its native body

 @throws NativeBatchBuildError when the original method entry is absent or duplicated
 */
function observeMessageMethod({
  source,
  method
}: {
 readonly source: string;
 readonly method: 'steer' | 'followUp';
}): string {
 /**
  The exact native method entry preserves the original source qualification.
  */
 const entry = `    ${method}(message) {\n`;
 return replaceOnce({
   source,
   from: entry,
   to: `${entry}        this.#inputObserver?.({frame:arguments,method:${JSON.stringify(method)}});\n`
 });
}

/**
 Observe original Agent input frames without changing borrowed constructor options.

 @param source - original Agent module after native state ownership is connected

 @returns source retaining fixed observer attachment and original input method occurrences

 @throws NativeBatchBuildError when a qualified original method site is absent or duplicated

 @example
 ```ts
 const generated = agentInputSource(stateOwnedAgent);
 ```
 */
export function agentInputSource(source: string): string {
 /**
  Observer attachment has a separate source transformation diagnostic boundary.
  */
 const rl = tagged({
   tag: agentInputSource.name,
   l
 });
 rl.debug('preparing original Agent input frame observations');
 /**
  The original Agent retains attachment state and validates its private assignment capability.
  */
 const attachmentSource = replaceOnce({
   source,
   from:'export class Agent {',
   to:`let attachInputObserver, assertStateAssignment;
export class NativeAgentInputAttachmentError extends Error {
 constructor(message){super(message);this.name=this.constructor.name;}
}
export function attachNativeAgentInputObserver({agent,observe}){return attachInputObserver(agent,observe);}
export function assertNativeAgentStateAssignment(input){assertStateAssignment(input);}
export class Agent {
    #inputObserver;
    static {
        attachInputObserver=(agent,observe)=>{
            if(typeof observe!=="function")throw new NativeAgentInputAttachmentError("Native Agent input observation requires a fixed function");
            if(agent.#inputObserver!==undefined)throw new NativeAgentInputAttachmentError("Native Agent already has its original input observer");
            agent.#inputObserver=observe;
            return agent.#nativeStateAssignment;
        };
        assertStateAssignment=({agent,assignment})=>{
            if(typeof assignment!=="function"||agent.#inputObserver===undefined||assignment!==agent.#nativeStateAssignment)throw new NativeAgentInputAttachmentError("Native state assignment requires this Agent's original attached function");
        };
    }`
 });
 /**
  Steering captures its original call frame before queueing or conversion.
  */
 const steeringSource = observeMessageMethod({
   source: attachmentSource,
   method: 'steer'
 });
 /**
  Follow-up inputs retain their separate original method identity.
  */
 const followUpSource = observeMessageMethod({
   source: steeringSource,
   method: 'followUp'
 });
 return replaceOnce({
   source: followUpSource,
   from:'    async prompt(input, images) {\n',
   to:'    async prompt(input, images) {\n        this.#inputObserver?.({frame:arguments,method:"prompt"});\n'
 });
}

//endregion Original Agent methods retain argument frames before native processing
