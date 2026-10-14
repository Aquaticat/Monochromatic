import assert from 'node:assert/strict';
function once({source,before,after}){assert.equal(source.split(before).length,2,before);return source.replace(before,after);}
export function generateCompletion(source){
 let value=once({source,before:'let nativeDispose, readActiveManager;',after:`const disposalStates = Object.freeze({
    unused: Object.freeze({ entered: false, inProgress: false, completed: false }),
    running: Object.freeze({ entered: true, inProgress: true, completed: false }),
    incomplete: Object.freeze({ entered: true, inProgress: false, completed: false }),
    complete: Object.freeze({ entered: true, inProgress: false, completed: true }),
});
let nativeDispose, readActiveManager, readDisposalState;
export function readSessionDisposalState(session) { return readDisposalState(session); }`});
 value=once({source:value,before:'    #custodyDisposed = false;',after:'    #custodyDisposed = false;\n    #custodyDisposalDepth = 0;\n    #custodyDisposalCompleted = false;'});
 value=once({source:value,before:'        nativeDispose = function () { return this.#disposeNative(); };',after:`        nativeDispose = function () { return this.#disposeNative(); };
        readDisposalState = (session) => {
            if (session.#custodyDisposalDepth > 0) return disposalStates.running;
            if (session.#custodyDisposalCompleted) return disposalStates.complete;
            return session.#custodyDisposed ? disposalStates.incomplete : disposalStates.unused;
        };`});
 const marker='    #disposeNative() {\n',start=value.indexOf(marker),end=value.indexOf('\n    }\n',start);assert(start>=0&&end>start);const body=value.slice(start+marker.length,end);
 assert(body.startsWith('        this.#custodyDisposed = true;'));assert(body.includes('cleanupSessionResources(this.sessionId);'));
 const replacement=marker+`        this.#custodyDisposalDepth += 1;
        this.#custodyDisposalCompleted = false;
        let completed = false;
        try {
`+body+`
            completed = true;
        } finally {
            this.#custodyDisposalDepth -= 1;
            this.#custodyDisposalCompleted = this.#custodyDisposalDepth === 0 && completed;
        }`;
 value=value.slice(0,start)+replacement+value.slice(end);return value;
}
