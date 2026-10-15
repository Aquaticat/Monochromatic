/** Built current-member inspection preserves ownership and original dependency boundaries. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createInspectionFixture } from './native-inspection-fixture.ts';

//region Current reads retain exact ordering, identities, and original callback failures.
await describe({ name: '', children: [
  it({ name: 'constructs lazily and returns frozen original prepared member views', fn: async function readsPrepared() {
    /** Original records and signals must remain identical through inspection. */
    const f = createInspectionFixture();
    assert.deepEqual(f.events, []);
    for (const [ordinal, handle] of [...f.byMember.values()].entries()) {
      f.events.length = 0;
      /** Prepared lookup checks ownership before observing dependencies. */
      const view = f.owner.preparedMemberFor(handle);
      /** Corresponding original record supplies all exposed identities. */
      const record = f.records[ordinal];
      assert.ok(record !== undefined);
      assert.deepEqual(f.events, ['ownership', 'dependencies', 'parent']);
      assert.deepEqual(Object.keys(view), ['prepared', 'signal', 'programInspection']);
      assert.ok(Object.isFrozen(view));
      assert.equal(view.prepared, record.prepared);
      assert.equal(view.signal, f.controller.signal);
      assert.equal(view.programInspection, record.preparedProgram?.view);
    }
  } }),
  it({ name: 'forwards original file handle and prepared path after readiness and parent checks', fn: async function readsOriginalFile() {
    /** Parent validation may update the original dependency handle before file access. */
    const f = createInspectionFixture();
    /** The replacement remains observable by reference. */
    const handle = Object.freeze({});
    f.state.onStep = function replaceHandle(point) {
      if (point === 'parent') f.preparation.handle = handle;
    };
    for (const member of f.byMember.values()) {
      f.events.length = 0;
      assert.equal(f.owner.originalFileFor(member), f.file);
      assert.deepEqual(f.events, ['ready', 'ownership', 'parent', 'file']);
      assert.deepEqual(f.fileCalls.at(-1), { handle, absolutePath: f.bindings.get(member)?.prepared.input.path });
      assert.equal(f.fileCalls.at(-1)?.handle, handle);
    }
    /** An absent original path is forwarded unchanged. */
    const record = f.records[0];
    assert.ok(record !== undefined);
    delete record.prepared.input.path;
    delete f.state.onStep;
    delete f.preparation.handle;
    assert.equal(f.owner.originalFileFor(f.byMember.get('z')), f.file);
    assert.deepEqual(f.fileCalls.at(-1), { handle: undefined, absolutePath: undefined });
  } }),
  ...['preparedMemberFor', 'originalFileFor'].map(function foreignOperation(operation) {
    return it({ name: `rejects foreign ownership at original ${operation} boundary`, fn: async function rejectsForeign() {
      /** Foreign handles must not reach parent or file reads. */
      const f = createInspectionFixture();
      assert.throws(function readForeign() {
        if (operation === 'preparedMemberFor') f.owner.preparedMemberFor(Object.freeze({}));
        else f.owner.originalFileFor(Object.freeze({}));
      });
      assert.deepEqual(f.events, operation === 'preparedMemberFor' ? ['ownership'] : ['ready', 'ownership']);
    } });
  }),
  ...[
    { operation: 'preparedMemberFor', steps: ['ownership', 'dependencies', 'parent'] },
    { operation: 'originalFileFor', steps: ['ready', 'ownership', 'parent', 'file'] },
  ].flatMap(function failureOperation({ operation, steps }) {
    return steps.map(function failurePoint(point, ordinal) {
      return it({ name: `retains original ${operation} failure at ${point}`, fn: async function retainsFailure() {
        /** Failure at a capability boundary prevents every later callback. */
        const f = createInspectionFixture();
        /** Identity is required, not merely an equal error message. */
        const failure = new Error(`original ${point} failure`);
        f.failures.set(point, failure);
        assert.throws(function readFailed() {
          if (operation === 'preparedMemberFor') f.owner.preparedMemberFor(f.byMember.get('z'));
          else f.owner.originalFileFor(f.byMember.get('z'));
        }, function originalFailure(error: unknown) { return error === failure; });
        assert.deepEqual(f.events, steps.slice(0, ordinal + 1));
      } });
    });
  }),
] });
//endregion
