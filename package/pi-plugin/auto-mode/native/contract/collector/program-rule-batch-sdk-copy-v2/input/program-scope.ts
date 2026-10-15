/**
 Original parent occurrence retains its recorder, labels, and serial queue lifetime. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';

/**
 Native recorder ownership is shared by the private parent token and public call identifier.
 */
export type ProgramScope<Recorder extends object> = {
  readonly recorder: Recorder;
  nextId: number;
  holdsQueue: boolean;
  readonly owner: object;
};

/**
 Queue acquisition publishes its successor before waiting for the preceding turn.
 */
export type ProgramQueue = { queueTail: Promise<unknown> };

/**
 Scope diagnostics omit tool identifiers and recorder contents.
 */
const l = tagged({ tag: 'auto-mode-program-scope' });

//region Original parent identity owns one recorder even when reached groups change.
/**
 Retain one native recorder under the original parent token and public label.

 @param runner - original shared recorder membership

 @param carrier - original parent occurrence identity

 @param parentId - original public recorder label

 @param NestedCallRecorder - original recorder constructor invoked only for a new scope

 @returns original retained mutable scope without duplicating its recorder

 @throws Error when the public label already belongs to another scope

 @example requireProgramScope({ runner, carrier, parentId, NestedCallRecorder });
 */
export function requireProgramScope<const Recorder extends object>({
  runner,
  carrier,
  parentId,
  NestedCallRecorder,
}: Readonly<{
  runner: Readonly<{ scopes: Map<object | string, ProgramScope<Recorder>> }>;
  carrier: Readonly<{ token: object }>;
  parentId: string;
  NestedCallRecorder: new () => Recorder;
}>): ProgramScope<Recorder> {
  /**
   Original lookup and publication remain synchronous.
   */
  const rl = tagged({
    tag: requireProgramScope.name,
    l
  });
  rl.debug('looking up original parent recorder');
  /**
   Retained token membership takes precedence over the public label lookup.
   */
  const retained = runner.scopes
    .get(carrier.token);
  if (retained) {
    rl.debug('retaining original parent recorder');
    return retained;
  }
  if (runner.scopes
    .has(parentId)) throw new Error('Native root recorder label already belongs to another scope');
  /**
   Initial mutable counters belong to the native runner and its original recorder.
   */
  const scope = {
    recorder: new NestedCallRecorder(),
    nextId: 1,
    holdsQueue: false,
    owner: carrier.token
  };
  runner.scopes
    .set(
      carrier.token,
      scope
    );
  runner.scopes
    .set(
      parentId,
      scope
    );
  rl.debug('published original parent recorder');
  return scope;
}
//endregion

//region Queue publication precedes waiting and disposal releases the original successor.
/**
 Acquire one native queue turn whose complete dispatch scope controls release.

 @param runner - original serial queue owner shared by reached groups

 @returns synchronous disposer releasing only this acquired turn

 @example using turn = await acquireProgramQueue(runner);
 */
export async function acquireProgramQueue(runner: ProgramQueue): Promise<Disposable> {
  /**
   Queue lifecycle diagnostics never inspect the preceding turn's result or failure.
   */
  const rl = tagged({
    tag: acquireProgramQueue.name,
    l
  });
  rl.debug('publishing next original queue turn');
  /**
   Retain the exact preceding turn before replacing the runner's shared tail.
   */
  const previous = runner.queueTail;
  /**
   Original successor remains unresolved until the acquired turn is disposed.
   */
  const turn = Promise.withResolvers<void>();
  runner.queueTail = turn.promise;
  await previous;
  rl.debug('acquired original queue turn');
  return {
    [Symbol.dispose](): void {
      rl.debug('releasing original queue turn');
      turn.resolve();
    },
  };
}
//endregion
