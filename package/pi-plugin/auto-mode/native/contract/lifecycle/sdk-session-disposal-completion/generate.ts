/**
 Retain native disposal completion separately from lifetime invalidation and nested cleanup depth.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeBatchBuildError } from '../../integration/native-batch/build-entries.ts';
import { replaceOnce } from '../../integration/native-batch/build-rebase.ts';

//region Completion readers preserve native disposal retry and nesting semantics

/**
 Disposal source transformation diagnostics retain their own module boundary.
 */
const l = tagged({ tag: 'auto-mode-native-session-disposal-source' });

/**
 Add original disposal state readers while preserving native cleanup and completion ordering.

 @param source - qualified native Session after lifetime ownership is installed

 @returns native source distinguishing unused, running, incomplete, and complete disposal

 @throws NativeBatchBuildError when original lifetime or disposal source sites change

 @example
 ```ts
 const generated = generateCompletion(lifetimeOwnedSession);
 ```
 */
export function generateCompletion(source: string): string {
 /**
  Each generated completion boundary retains its original transformation diagnostic.
  */
 const rl = tagged({ tag: generateCompletion.name, l });
 rl.debug('preparing native disposal completion observations');
 /**
  Shared immutable states retain the native disposal reader's original result identities.
  */
 const statesSource = replaceOnce({
   source,
   from:'let nativeDispose, readActiveManager;',
   to:`const disposalStates = Object.freeze({
    unused: Object.freeze({ entered: false, inProgress: false, completed: false }),
    running: Object.freeze({ entered: true, inProgress: true, completed: false }),
    incomplete: Object.freeze({ entered: true, inProgress: false, completed: false }),
    complete: Object.freeze({ entered: true, inProgress: false, completed: true }),
});
let nativeDispose, readActiveManager, readDisposalState;
export function readSessionDisposalState(session) { return readDisposalState(session); }`
 });
 /**
  Original Session instances retain independent native cleanup depth and completion fields.
  */
 const fieldsSource = replaceOnce({
   source: statesSource,
   from:'    #custodyDisposed = false;',
   to:'    #custodyDisposed = false;\n    #custodyDisposalDepth = 0;\n    #custodyDisposalCompleted = false;'
 });
 /**
  Reader precedence preserves running cleanup before completed or incomplete lifetime states.
  */
 const readerSource = replaceOnce({
   source: fieldsSource,
   from:'        nativeDispose = function () { return this.#disposeNative(); };',
   to:`        nativeDispose = function () { return this.#disposeNative(); };
        readDisposalState = (session) => {
            if (session.#custodyDisposalDepth > 0) return disposalStates.running;
            if (session.#custodyDisposalCompleted) return disposalStates.complete;
            return session.#custodyDisposed ? disposalStates.incomplete : disposalStates.unused;
        };`
 });
 /**
  The qualified private method entry identifies the original disposal body.
  */
 const marker='    #disposeNative() {\n';
 /**
  Original entry and closing indentation delimit the qualified native method.
  */
 const start=readerSource.indexOf(marker);
 /**
  This boundary retains the original native method's complete cleanup body.
  */
 const end=readerSource.indexOf(
   '\n    }\n',
   start
 );
 if (start === -1 || end <= start) throw new NativeBatchBuildError('Native disposal method boundary is unavailable');
 /**
  Original native cleanup remains intact inside the completion wrapper.
  */
 const body=readerSource.slice(
   start+marker.length,
   end
 );
 if (!body.startsWith('        this.#custodyDisposed = true;') || !body.includes('cleanupSessionResources(this.sessionId);')) throw new NativeBatchBuildError('Native disposal body no longer matches its original lifetime and cleanup boundaries');
 /**
  Completion is published only after the outermost original native cleanup finishes successfully.
  */
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
 return readerSource.slice(
   0,
   start
 )+replacement
   +readerSource.slice(end);
}

//endregion Completion readers preserve native disposal retry and nesting semantics
