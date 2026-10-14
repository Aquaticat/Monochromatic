import assert from 'node:assert/strict';

/** Observe external assignments while native reset retains its original setter semantics. */
export function agentStateSource(source){
 function replace({
   before,
   after
 }){assert.equal(
   source.split(before)
     .length,
   2,
   `Native Agent state edit: ${before}`
 );source=source.replace(
   before,
   after
 );}
 assert.equal(
   (source.match(/this\._state\.messages\s*=/g)??[]).length,
   1,
   'Revalidate native Agent message assignments'
 );
 replace({
   before:'function createMutableAgentState(initialState) {',
   after:'const stateDescriptor = Object.getOwnPropertyDescriptor, invokeStateSetter = Reflect.apply;\nfunction createMutableAgentState(initialState, observe) {\n    const nativeAssignment = Object.freeze({});'
 });
 replace({
   before:'    return {\n        get systemPrompt() {',
   after:'    const state = {\n        get systemPrompt() {'
 });
 replace({
   before:'        set tools(nextTools) {\n            tools = nextTools.slice();',
   after:'        set tools(nextTools) {\n            observe?.({frame:arguments,method:"state.tools"});\n            tools = nextTools.slice();'
 });
 replace({
   before:'        set messages(nextMessages) {\n            messages = nextMessages.slice();',
   after:'        set messages(nextMessages) {\n            if(arguments.length!==2||arguments[1]!==nativeAssignment)observe?.({frame:arguments,method:"state.messages"});\n            messages = nextMessages.slice();'
 });
 replace({
   before:'    };\n}\nclass PendingMessageQueue {',
   after:`    };
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
 replace({
   before:'export class Agent {',
   after:'export class Agent {\n    #nativeStateAssignment;'
 });
 replace({
   before:'        this._state = createMutableAgentState(runtimeOptions.initialState);',
   after:'        const nativeState = createMutableAgentState(runtimeOptions.initialState, input => this.#inputObserver?.(input));\n        this._state = nativeState.state;\n        this.#nativeStateAssignment = nativeState.assign;'
 });
 replace({
   before:'        this._state.messages = baseline ? [baseline] : [];',
   after:'        this.#nativeStateAssignment({target:this._state,nextMessages:baseline ? [baseline] : []});'
 });
 return source;
}

/** A verified constructor argument is installed before prepareLoadout can reenter native Session operations. */
export function sessionStateSource(source){
 function replace({
   before,
   after
 }){assert.equal(
   source.split(before)
     .length,
   2,
   `Native Session state edit: ${before}`
 );source=source.replace(
   before,
   after
 );}
 assert.equal(
   (source.match(/this\.agent\.state\.messages\s*=/g)??[]).length,
   1,
   'Revalidate native Session message assignments'
 );
 replace({
   before:'export class AgentSession {',
   after:'export class AgentSession {\n    #nativeStateAssignment;'
 });
 replace({
   before:'    constructor(config) {\n        this.agent = config.agent;',
   after:'    constructor(config, nativeStateAssignment) {\n        this.agent = config.agent;\n        if(nativeStateAssignment!==undefined){\n            assertNativeAgentStateAssignment({agent:this.agent,assignment:nativeStateAssignment});\n            this.#nativeStateAssignment=nativeStateAssignment;\n        }'
 });
 replace({
   before:'        this.agent.state.messages = projection.messages;',
   after:'        if(this.#nativeStateAssignment)this.#nativeStateAssignment({target:this.agent.state,nextMessages:projection.messages});\n        else this.agent.state.messages = projection.messages;'
 });
 return source;
}
