/**
 Consumer interfaces and isolated inputs exercise the built native context observer.

 @module
 */

//region Tests load the built artifact without importing maintained implementation types

/** Original native traversal stage supplied by the emitter. */
export type ContextKind = 'context' | 'context_with_system';
/** Captured callback boundary as consumed by the native manager pool. */
export type ContextInput = {
  readonly kind: ContextKind;
  readonly phase: string;
  readonly ordinal: number;
  readonly path: string;
  readonly value: unknown;
};
/** Native emitter interface exercised independently of source implementation types. */
export type ContextObserver = {
  readonly begin: (input: {readonly kind: ContextKind; readonly snapshot: readonly {
    readonly ext: object; readonly handlers: readonly (() => void)[];
  }[]}) => void;
  readonly before: (input: {readonly extension: object; readonly handler: () => void; readonly event: unknown}) => void;
  readonly returned: (result: unknown) => void;
  readonly failed: (error: unknown) => void;
  readonly end: (kind: ContextKind) => void;
  readonly complete: () => {readonly kinds: readonly ContextKind[]; readonly handlers: number};
};
/** Constructor exported by the copied native artifact. */
type ContextModule = {readonly createNativeContextObserver: (capture: (input: ContextInput) => void) => ContextObserver};
/**
 Check callable exports before exercising the declared consumer interface.

 @param value - built module namespace

 @throws Error when the built observer export is absent
 */
function assertContextModule(value: unknown): asserts value is ContextModule {
  if(value===null||typeof value!=='object'||!('createNativeContextObserver' in value)||typeof value.createNativeContextObserver!=='function')
    throw new Error('Built native context observer is unavailable');
}
/** Copied runtime selected by generated native SessionManager modules. */
const built: unknown = await import(new URL('../dist/native/contract/integration/native-batch/context-observer.ts',import.meta.url).href);
assertContextModule(built);
/** Checked built constructor supplies all behavior under test. */
export const nativeContext: ContextModule = built;

//endregion Tests load the built artifact without importing maintained implementation types

//region Every fixture retains its own callback and mutable event

/**
 Capture a thrown value without treating an undefined throw as success.

 @param run - isolated synchronous operation expected to fail

 @returns original thrown value

 @throws Error when the operation did not throw
 */
export function contextFailure(run: () => unknown): unknown {
  try { run(); } catch(error) { return error; }
  throw new Error('Expected native context operation to throw');
}
/**
 Construct original callback references and an owned receipt sink.

 @param capture - optional original manager failure boundary

 @returns independent observer and original native positions
 */
export function contextFixture(capture?: (input: ContextInput) => void) {
  /** Owned snapshots are independent of later callback mutation. */
  const records: ContextInput[] = [];
  /** Distinct native extension identity. */
  const extension = {path:'fixture-context-extension'};
  /** Only identity is consumed by the observer; native dispatch owns invocation. */
  function handler(): void {}
  /** Exact event remains mutable through native callback settlement. */
  const message={role:'user',content:'original text'};
  /** Native event owns the message array consumed by this fixture. */
  const event = {type:'context',messages:[message]};
  /** Copies are made at capture time, as the existing manager source pool does. */
  const observer = nativeContext.createNativeContextObserver(capture??function retain(input) { records.push(structuredClone(input)); });
  return {observer,records,extension,handler,event,message,snapshot:[{ext:extension,handlers:[handler]}],position:{extension,handler,event}};
}
/**
 Complete the empty second native stage after a fixture closes its first stage.

 @param observer - original observer ready for context_with_system

 @returns original immutable completion receipt
 */
export function completeContext(observer: ContextObserver) {
  observer.begin({kind:'context_with_system',snapshot:[]});
  observer.end('context_with_system');
  return observer.complete();
}

//endregion Every fixture retains its own callback and mutable event
