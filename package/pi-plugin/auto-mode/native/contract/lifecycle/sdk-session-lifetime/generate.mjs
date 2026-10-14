import assert from 'node:assert/strict';

//region A private session-lifetime reader is separate from content and manager-occurrence freshness.
function replaceOne({
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
export function generateSession(source){
  assert.equal(
    source.includes('#custodyDisposed'),
    false
  );
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
  let value=replaceOne({
    source,
    before:'export class AgentSession {',
    after:prefix
  });
  value=replaceOne({
    source:value,
    before:'    sessionManager;',
    after:'    #sessionManager;'
  });
  value=value.replaceAll(
    /this\.sessionManager\b/g,
    'this.#sessionManager'
  );
  const assignment='        this.#sessionManager = config.sessionManager;';
  value=replaceOne({
    source:value,
    before:assignment,
    after:`${assignment}
        Object.defineProperties(this, {
            sessionManager: { get: () => this.#sessionManager, enumerable: true, configurable: false },
            dispose: { value: nativeDispose, writable: false, configurable: false },
        });`
  });
  value=replaceOne({
    source:value,
    before:'    dispose() {\n        try {',
    after:'    dispose() { return this.#disposeNative(); }\n    #disposeNative() {\n        this.#custodyDisposed = true;\n        try {'
  });
  value+='\n// Protect the native disposal route without freezing unrelated mutable session state.\nObject.defineProperty(AgentSession.prototype, "dispose", { writable: false, configurable: false });\n';
  return value;
}
//endregion
