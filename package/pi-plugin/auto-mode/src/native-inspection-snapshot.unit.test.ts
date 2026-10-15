/** Built retained inspection preserves immutable snapshots without live eligibility checks. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createInspectionFixture } from './native-inspection-fixture.ts';

//region Retained diagnostics preserve original collection order and terminal identities.
await describe({ name: '', children: [
  it({ name: 'retains frozen ordered snapshots after cancellation and closure failure', fn: async function retainsSnapshot() {
    /** Live capabilities deliberately fail while retained inspection stays available. */
    const f = createInspectionFixture();
    for (const point of ['ownership', 'dependencies', 'parent', 'ready']) f.failures.set(point, new Error(`inactive ${point}`));
    f.controller.abort(new Error('cancelled original judgment'));
    /** Initial snapshot remains independent of later lifecycle changes. */
    const initial = f.owner.inspect();
    assert.deepEqual(f.events, ['accounting', 'program', 'program', 'group', 'group']);
    assert.deepEqual(Object.keys(initial), ['prepared', 'preparationFailed', 'preparationFailure', 'finished', 'closeFailed', 'accounting', 'finalRecord', 'memberExecutions', 'preparedPrograms', 'rootPrograms', 'childGroups']);
    assert.ok(Object.isFrozen(initial));
    assert.equal(initial.accounting, f.accounting);
    assert.equal(initial.prepared, false);
    assert.equal(initial.preparationFailed, false);
    assert.equal(initial.preparationFailure, undefined);
    assert.equal(initial.finished, false);
    assert.equal(initial.closeFailed, false);
    assert.equal(initial.finalRecord, undefined);
    for (const collection of [initial.memberExecutions, initial.preparedPrograms, initial.rootPrograms, initial.childGroups]) assert.ok(Object.isFrozen(collection));
    assert.deepEqual(initial.memberExecutions, [{ id: 'z', state: 'unentered' }, { id: 'absent', state: 'active' }, { id: 'a', state: 'returned' }]);
    for (const execution of initial.memberExecutions) assert.ok(Object.isFrozen(execution));
    assert.equal(initial.preparedPrograms.length, 2);
    assert.equal(initial.rootPrograms.length, 2);
    assert.equal(initial.childGroups.length, 2);
    assert.equal(initial.preparedPrograms[0], f.preparedViews[0]);
    assert.equal(initial.preparedPrograms[1], f.preparedViews[1]);
    for (const [ordinal, index] of [0, 2].entries()) {
      /** Optional native roots preserve declaration order and original reader results. */
      const record = f.records[index];
      assert.ok(record?.program !== undefined);
      assert.equal(initial.rootPrograms[ordinal], f.views.get(record.program.handle));
    }
    for (const [ordinal, group] of f.childGroups.entries()) assert.equal(initial.childGroups[ordinal], f.views.get(group.handle));
    /** Original terminal records and failures stay distinguishable by identity. */
    const failure = new Error('original preparation failed');
    /** Final record remains owned by lifecycle. */
    const finalRecord = Object.freeze({ reason: 'original closure' });
    f.preparation.prepared = true;
    f.preparation.preparationFailed = true;
    f.preparation.preparationFailure = failure;
    f.lifecycle.finished = true;
    f.lifecycle.closeFailed = true;
    f.lifecycle.finalRecord = finalRecord;
    f.byMember.clear();
    f.childGroups.length = 0;
    f.events.length = 0;
    /** Later snapshot reads current state while old collections remain intact. */
    const terminal = f.owner.inspect();
    assert.deepEqual(f.events, ['accounting']);
    assert.equal(terminal.prepared, true);
    assert.equal(terminal.preparationFailed, true);
    assert.equal(terminal.preparationFailure, failure);
    assert.equal(terminal.finished, true);
    assert.equal(terminal.closeFailed, true);
    assert.equal(terminal.finalRecord, finalRecord);
    for (const collection of [terminal.memberExecutions, terminal.preparedPrograms, terminal.rootPrograms, terminal.childGroups]) {
      assert.ok(Object.isFrozen(collection));
      assert.deepEqual(collection, []);
    }
    assert.equal(initial.prepared, false);
    assert.equal(initial.finished, false);
    assert.equal(initial.memberExecutions.length, 3);
    assert.equal(initial.childGroups.length, 2);
  } }),
  ...[
    { point: 'accounting', events: ['accounting'] },
    { point: 'program', events: ['accounting', 'program'] },
    { point: 'group', events: ['accounting', 'program', 'program', 'group'] },
  ].map(function failurePoint({ point, events }) {
    return it({ name: `propagates retained ${point} failure without live checks`, fn: async function retainsFailure() {
      /** Retained readers must not catch or replace original capability failures. */
      const f = createInspectionFixture();
      /** Exact error identity distinguishes propagation from reconstruction. */
      const failure = new Error(`original ${point} failure`);
      f.failures.set(point, failure);
      assert.throws(function inspectFailed() { f.owner.inspect(); }, function originalFailure(error: unknown) { return error === failure; });
      assert.deepEqual(f.events, events);
    } });
  }),
] });
//endregion
