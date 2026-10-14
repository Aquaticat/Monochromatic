import assert from 'node:assert/strict';

function once({
  source,
  before,
  after
}){assert.equal(
  source.split(before)
    .length,
  2,
  before
);return source.replace(
  before,
  after
);}
export function generateCompletion(source){
 let value=once({
   source,
   before:'let nativeDispose, readActiveManager;',
   after:`const disposalStates = Object.freeze({
    unused: Object.freeze({ entered: false, inProgress: false, completed: false }),
    running: Object.freeze({ entered: true, inProgress: true, completed: false }),
    incomplete: Object.freeze({ entered: true, inProgress: false, completed: false }),
    complete: Object.freeze({ entered: true, inProgress: false, completed: true }),
});
let nativeDispose, readActiveManager, readDisposalState;
export function readSessionDisposalState(session) { return readDisposalState(session); }`
 });
 value=once({
   source:value,
   before:'    #custodyDisposed = false;',
   after:'    #custodyDisposed = false;\n    #custodyDisposalDepth = 0;\n    #custodyDisposalCompleted = false;'
 });
 value=once({
   source:value,
   before:'        nativeDispose = function () { return this.#disposeNative(); };',
   after:`        nativeDispose = function () { return this.#disposeNative(); };
        readDisposalState = (session) => {
            if (session.#custodyDisposalDepth > 0) return disposalStates.running;
            if (session.#custodyDisposalCompleted) return disposalStates.complete;
            return session.#custodyDisposed ? disposalStates.incomplete : disposalStates.unused;
        };`
 });
 const marker='    #disposeNative() {\n';
   const start=value.indexOf(marker);
   const end=value.indexOf(
   '\n    }\n',
   start
 );assert.ok((start!==(-1))&&(end>start));const body=value.slice(
   start+marker.length,
   end
 );
 assert.ok(body.startsWith('        this.#custodyDisposed = true;'));assert.ok(body.includes('cleanupSessionResources(this.sessionId);'));
 const replacement=`${marker}        if(this.#custodyDisposalCompleted)return;
        this.#custodyDisposalDepth += 1;
        this.#custodyDisposalCompleted = false;
        let completed = false;
        try {
${body}
            completed = true;
        } finally {
            this.#custodyDisposalDepth -= 1;
            this.#custodyDisposalCompleted = this.#custodyDisposalDepth === 0 && completed;
        }`;
 value=value.slice(
   0,
   start
 )+replacement
   +value.slice(end);return value;
}
