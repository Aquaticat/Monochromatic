/**
 Preserve native state setter semantics while observing original external assignments.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { assertNativeMessageAssignment } from './build-state-assignments.ts';

//region Original Agent setters distinguish native reset from outside mutation

/**
 State source transformations have a distinct diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-agent-state-source' });

/**
 Observe external assignments while native reset retains its original setter semantics.

 @param source - qualified original Agent module

 @returns source preserving the native assignment owner and setter checks

 @throws NativeStateBuildError when original assignment membership changes

 @throws NativeBatchBuildError when a qualified source edit is absent or duplicated

 @example
 ```ts
 const generated = agentStateSource(originalAgent);
 ```
 */
export function agentStateSource(source: string): string {
 /**
  Entry diagnostics identify the native state generator.
  */
 const rl = tagged({ tag: agentStateSource.name, l });
 rl.debug('preparing original Agent state observations');
 assertNativeMessageAssignment({ source, owner: 'Agent' });
 /**
  One private occurrence token distinguishes the native setter call.
  */
 const tokenSource = replaceOnce({
   source,
   from:'function createMutableAgentState(initialState) {',
   to:'const stateDescriptor = Object.getOwnPropertyDescriptor, invokeStateSetter = Reflect.apply;\nfunction createMutableAgentState(initialState, observe) {\n    const nativeAssignment = Object.freeze({});'
 });
 /**
  Retain the original state object for descriptor comparisons.
  */
 const objectSource = replaceOnce({
   source: tokenSource,
   from:'    return {\n        get systemPrompt() {',
   to:'    const state = {\n        get systemPrompt() {'
 });
 /**
  Tool assignments keep their original argument frame before native copying.
  */
 const toolsSource = replaceOnce({
   source: objectSource,
   from:'        set tools(nextTools) {\n            tools = nextTools.slice();',
   to:'        set tools(nextTools) {\n            observe?.({frame:arguments,method:"state.tools"});\n            tools = nextTools.slice();'
 });
 /**
  Only the original native occurrence can omit external-assignment observation.
  */
 const messagesSource = replaceOnce({
   source: toolsSource,
   from:'        set messages(nextMessages) {\n            messages = nextMessages.slice();',
   to:'        set messages(nextMessages) {\n            if(arguments.length!==2||arguments[1]!==nativeAssignment)observe?.({frame:arguments,method:"state.messages"});\n            messages = nextMessages.slice();'
 });
 /**
  Native reset uses the original setter only while every descriptor field still matches.
  */
 const assignmentSource = replaceOnce({
   source: messagesSource,
   from:'    };\n}\nclass PendingMessageQueue {',
   to:`    };
    const originalDescriptor = stateDescriptor(state, "messages");
    const assign = ({target,nextMessages}) => {
        const current = target===state ? stateDescriptor(target, "messages") : undefined;
        if(current && current.get===originalDescriptor.get && current.set===originalDescriptor.set
            && current.enumerable===originalDescriptor.enumerable && current.configurable===originalDescriptor.configurable) {
            invokeStateSetter(originalDescriptor.set,target,[nextMessages,nativeAssignment]);
        } else {
            target.messages=nextMessages;
        }
    };
    return Object.freeze({state,assign});
}
class PendingMessageQueue {`
 });
 /**
  Assignment authority remains private to the constructed native Agent.
  */
 const fieldSource = replaceOnce({
   source: assignmentSource,
   from:'export class Agent {',
   to:'export class Agent {\n    #nativeStateAssignment;'
 });
 /**
  Construction connects the original state and its native assignment capability together.
  */
 const constructorSource = replaceOnce({
   source: fieldSource,
   from:'        this._state = createMutableAgentState(runtimeOptions.initialState);',
   to:'        const nativeState = createMutableAgentState(runtimeOptions.initialState, input => this.#inputObserver?.(input));\n        this._state = nativeState.state;\n        this.#nativeStateAssignment = nativeState.assign;'
 });
 return replaceOnce({
   source: constructorSource,
   from:'        this._state.messages = baseline ? [baseline] : [];',
   to:'        this.#nativeStateAssignment({target:this._state,nextMessages:baseline ? [baseline] : []});'
 });
}

//endregion Original Agent setters distinguish native reset from outside mutation

//region Session construction installs verified assignment authority before native hooks

/**
 Install a verified constructor argument before loadout hooks can reenter native Session operations.

 @param source - qualified original Session module

 @returns source retaining the original fallback assignment when no owner is supplied

 @throws NativeStateBuildError when original assignment membership changes

 @throws NativeBatchBuildError when a qualified source edit is absent or duplicated

 @example
 ```ts
 const generated = sessionStateSource(originalSession);
 ```
 */
export function sessionStateSource(source: string): string {
 /**
  Session construction retains a distinct transformation diagnostic.
  */
 const rl = tagged({ tag: sessionStateSource.name, l });
 rl.debug('preparing original Session state assignment');
 assertNativeMessageAssignment({ source, owner: 'Session' });
 /**
  The optional native assignment capability remains private to this Session.
  */
 const fieldSource = replaceOnce({
   source,
   from:'export class AgentSession {',
   to:'export class AgentSession {\n    #nativeStateAssignment;'
 });
 /**
  The Agent owner validates the capability before any reentrant native hook can use it.
  */
 const constructorSource = replaceOnce({
   source: fieldSource,
   from:'    constructor(config) {\n        this.agent = config.agent;',
   to:'    constructor(config, nativeStateAssignment) {\n        this.agent = config.agent;\n        if(nativeStateAssignment!==undefined){\n            assertNativeAgentStateAssignment({agent:this.agent,assignment:nativeStateAssignment});\n            this.#nativeStateAssignment=nativeStateAssignment;\n        }'
 });
 return replaceOnce({
   source: constructorSource,
   from:'        this.agent.state.messages = projection.messages;',
   to:'        if(this.#nativeStateAssignment)this.#nativeStateAssignment({target:this.agent.state,nextMessages:projection.messages});\n        else this.agent.state.messages = projection.messages;'
 });
}

//endregion Session construction installs verified assignment authority before native hooks
