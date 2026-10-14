/**
 Retain original native Session liveness independently of manager occurrence and content freshness.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeBatchBuildError } from '../../integration/native-batch/build-entries.ts';
import { privatizeNativeMembers } from '../../integration/native-batch/build-members.ts';
import { replaceOnce } from '../../integration/native-batch/build-rebase.ts';

//region Original Session lifetime remains private to the native constructor

/**
 Lifetime source transformations retain their own diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-session-lifetime-source' });

/**
 Add original Session liveness checks while preserving native disposal entry and manager access.

 @param source - qualified original Session before lifetime ownership is installed

 @returns native Session source with private manager storage and original liveness readers

 @throws NativeBatchBuildError when ownership is already installed or original source sites change

 @example
 ```ts
 const generated = generateSession(originalSession);
 ```
 */
export function generateSession(source: string): string {
  /**
   Each lifetime preparation retains a separate diagnostic scope.
   */
  const rl = tagged({
    tag: generateSession.name,
    l
  });
  rl.debug('preparing original native Session lifetime ownership');
  if (source.includes('#custodyDisposed')) throw new NativeBatchBuildError('Native Session lifetime ownership is already installed');
  /**
   Native readers remain bound to the original private lifetime and manager fields.
   */
  const prefix=`let nativeDispose, readActiveManager;
export class NativeSessionDisposedError extends Error {
    constructor() { super("SDK session was disposed; construct a live session before reading its root"); this.name = "NativeSessionDisposedError"; }
}
export function readActiveSessionManager(session) { return readActiveManager(session); }
export class AgentSession {
    #custodyDisposed = false;
    static {
        nativeDispose = function () { return this.#disposeNative(); };
        readActiveManager = (session) => {
            if (session.#custodyDisposed) throw new NativeSessionDisposedError();
            return session.#sessionManager;
        };
    }`;
  /**
   The original class receives its fixed lifetime reader before construction can expose instances.
   */
  const lifetimeSource = replaceOnce({
    source,
    from:'export class AgentSession {',
    to:prefix
  });
  /**
   Original manager storage becomes private without changing its constructor value.
   */
  const fieldSource = replaceOnce({
    source: lifetimeSource,
    from:'    sessionManager;',
    to:'    #sessionManager;'
  });
  /**
   Only original direct instance references acquire private member syntax.
   */
  const referenceSource = privatizeNativeMembers({
    source: fieldSource,
    members: ['sessionManager']
  });
  /**
   The original constructor assignment remains the unique capability installation site.
   */
  const assignment='        this.#sessionManager = config.sessionManager;';
  /**
   Public manager reads and native disposal retain fixed original accessors.
   */
  const accessorSource = replaceOnce({
    source: referenceSource,
    from:assignment,
    to:`${assignment}
        Object.defineProperties(this, {
            sessionManager: { get: () => this.#sessionManager, enumerable: true, configurable: false },
            dispose: { value: nativeDispose, writable: false, configurable: false },
        });`
  });
  /**
   Native cleanup enters the private lifetime transition before its original disposal body.
   */
  const disposalSource = replaceOnce({
    source: accessorSource,
    from:'    dispose() {\n        try {',
    to:'    dispose() { return this.#disposeNative(); }\n    #disposeNative() {\n        this.#custodyDisposed = true;\n        try {'
  });
  return `${disposalSource  }\n// Protect the native disposal route without freezing unrelated mutable session state.\nObject.defineProperty(AgentSession.prototype, "dispose", { writable: false, configurable: false });\n`;
}

//endregion Original Session lifetime remains private to the native constructor
