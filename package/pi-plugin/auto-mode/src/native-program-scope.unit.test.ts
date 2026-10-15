/** Built original recorder scope retains token precedence, publication order, and failure identity. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { scopeModule, type ScopeFixtureRecord } from './native-program-scope-fixture.ts';

//region Original recorder publication retains a private token and public label without reinitializing counters.
await describe({ name: '', children: [
  it({ name: 'publishes one original recorder and retains mutable counters before conflicting label lookup', fn: async function originalRecorder() {
    /** Only this map belongs to the original fixture runner. */
    const scopes = new Map<string | object, ScopeFixtureRecord>();
    /** Original parent identity remains unrelated to its public label. */
    const token = Object.freeze({});
    /** Constructor returns this exact independently owned recorder. */
    const recorder = Object.freeze({});
    /** Constructor counts remain local to the original scope fixture. */
    const constructions: object[] = [];
    /** Native construction must receive no additional source arguments. */
    const NestedCallRecorder: typeof Map = new Proxy(Map, {
      construct(target, args, receiver): object {
        assert.equal(target, Map);
        assert.deepEqual(args, []);
        assert.equal(receiver, NestedCallRecorder);
        constructions.push(recorder);
        return recorder;
      },
    });
    /** Original scope initializes only after confirming the public label is free. */
    const scope = scopeModule.requireProgramScope({ runner: { scopes }, carrier: { token }, parentId: 'parent', NestedCallRecorder });
    assert.deepEqual(scope, { recorder, owner: token, nextId: 1, holdsQueue: false });
    assert.equal(scope.recorder, recorder);
    assert.equal(scope.owner, token);
    assert.deepEqual([...scopes.keys()], [token, 'parent']);
    assert.equal(scopes.get(token), scope);
    assert.equal(scopes.get('parent'), scope);
    scope.nextId = 17;
    scope.holdsQueue = true;
    assert.equal(scopeModule.requireProgramScope({ runner: { scopes }, carrier: { token }, parentId: 'parent', NestedCallRecorder }), scope);
    assert.equal(scope.nextId, 17);
    assert.equal(scope.holdsQueue, true);
    assert.deepEqual(constructions, [recorder]);
    assert.throws(function conflictingOwner() {
      scopeModule.requireProgramScope({ runner: { scopes }, carrier: { token: {} }, parentId: 'parent', NestedCallRecorder });
    }, { message: 'Native root recorder label already belongs to another scope' });
    assert.deepEqual(constructions, [recorder]);
    assert.equal(scopes.size, 2);
    /** Existing token ownership wins even if a different public label is occupied. */
    const foreign = { recorder: {}, owner: {}, nextId: 1, holdsQueue: false };
    scopes.set('conflict', foreign);
    assert.equal(scopeModule.requireProgramScope({ runner: { scopes }, carrier: { token }, parentId: 'conflict', NestedCallRecorder }), scope);
    assert.equal(scopes.get('conflict'), foreign);
  } }),
  it({ name: 'retains original constructor failure without publishing a partial scope', fn: async function failedRecorder() {
    /** Failed native construction cannot replace either original lookup key. */
    const scopes = new Map<string | object, ScopeFixtureRecord>();
    /** This exact original failure must escape without wrapping. */
    const failure = new Error('Original native recorder construction failed');
    /** Native construction failure occurs after collision checking and before publication. */
    const NestedCallRecorder = new Proxy(Map, { construct() { throw failure; } });
    assert.throws(function failed() {
      scopeModule.requireProgramScope({ runner: { scopes }, carrier: { token: {} }, parentId: 'parent', NestedCallRecorder });
    }, function original(error: unknown) { return error === failure; });
    assert.equal(scopes.size, 0);
  } }),
] });
//endregion
