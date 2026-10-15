/** Retain one native recorder under the original parent token and public label. */
export function requireProgramScope({ runner, carrier, parentId, NestedCallRecorder }) {
  const retained = runner.scopes.get(carrier.token);
  if (retained) return retained;
  if (runner.scopes.has(parentId)) throw new Error('Native root recorder label already belongs to another scope');
  const scope = { recorder: new NestedCallRecorder(), nextId: 1, holdsQueue: false, owner: carrier.token };
  runner.scopes.set(carrier.token, scope);
  runner.scopes.set(parentId, scope);
  return scope;
}

/** Release an acquired native queue turn when its complete dispatch scope exits. */
export async function acquireProgramQueue(runner) {
  const previous = runner.queueTail;
  const turn = Promise.withResolvers();
  runner.queueTail = turn.promise;
  await previous;
  return { [Symbol.dispose]() { turn.resolve(); } };
}
