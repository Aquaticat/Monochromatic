import assert from 'node:assert/strict';

/** Observe original Agent input frames without changing borrowed constructor options. */
export function agentInputSource(source){
 function replace({
   before,
   after
 }){
  assert.equal(
    source.split(before)
      .length,
    2,
    `Native Agent input edit: ${before}`
  );
  source=source.replace(
    before,
    after
  );
 }
 replace({
   before:'export class Agent {',
   after:`let attachInputObserver, assertStateAssignment;
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
 for(const method of [
   'steer',
   'followUp'
 ]){
  const entry=`    ${method}(message) {\n`;
  replace({
    before:entry,
    after:`${entry}        this.#inputObserver?.({frame:arguments,method:${JSON.stringify(method)}});\n`
  });
 }
 replace({
   before:'    async prompt(input, images) {\n',
   after:'    async prompt(input, images) {\n        this.#inputObserver?.({frame:arguments,method:"prompt"});\n'
 });
 return source;
}
