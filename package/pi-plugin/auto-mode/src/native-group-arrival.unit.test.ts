/** Original member admission and failure ordering retain exact source and callback boundaries. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createCollectorFixture } from './native-group-collector-fixture.ts';

await describe({ name: '', children: [
  //region Admission checks retain argument serialization, cancellation, and replay boundaries.
  ...[null, false, {}, 'signal'].map(function invalidSignal(signal) {
    return it({ name: `rejects invalid native signal ${JSON.stringify(signal)} before publishing arrival`, fn: async () => {
      const fixture = createCollectorFixture();
      const [result] = await Promise.allSettled([fixture.invoke({ signal })]);
      assert.ok(result?.status === 'rejected');
      assert.ok(Error.isError(result.reason));
      assert.equal(result.reason.message, 'Native member cancellation is required');
      assert.equal(fixture.run.inspect().members[0]?.arrival, 'unarrived');
      assert.equal(fixture.calls.length, 0);
    } });
  }),
  ...[{}, null, { mode: 'read', path: 'member-0' }, { path: 'member-0', mode: 'write' }].map(function changedArguments(args) {
    return it({ name: `rejects changed original argument serialization ${JSON.stringify(args)}`, fn: async () => {
      const fixture = createCollectorFixture();
      const [result] = await Promise.allSettled([fixture.invoke({ args })]);
      assert.ok(result?.status === 'rejected');
      assert.ok(Error.isError(result.reason));
      assert.equal(result.reason.message, 'Native member arguments differ from the declared callsite');
      assert.equal(fixture.run.inspect().members[0]?.arrival, 'unarrived');
      assert.equal(fixture.control.parents, 1);
      assert.equal(fixture.calls.length, 0);
    } });
  }),
  it({ name: 'retains original serialization failure without allocating delivery', fn: async () => {
    const fixture = createCollectorFixture();
    const failure = new Error('original native serialization failed');
    const args = { toJSON(): never { throw failure; } };
    const [result] = await Promise.allSettled([fixture.invoke({ args })]);
    assert.deepEqual(result, { status: 'rejected', reason: failure });
    assert.equal(fixture.run.inspect().failure, failure);
    assert.equal(fixture.run.inspect().members[0]?.arrival, 'unarrived');
  } }),
  it({ name: 'rejects replay and delivers the same original failure to pending members', fn: async () => {
    const fixture = createCollectorFixture();
    const first = fixture.invoke();
    const repeated = fixture.invoke();
    const results = await Promise.allSettled([first, repeated]);
    const failure = fixture.run.inspect().failure;
    assert.ok(Error.isError(failure));
    assert.equal(failure.message, 'Declared member callback cannot be replayed');
    assert.deepEqual(results, [{ status: 'rejected', reason: failure }, { status: 'rejected', reason: failure }]);
    assert.equal(fixture.run.inspect().members[0]?.state, 'rejected');
    assert.equal(fixture.run.inspect().members[1]?.state, 'unarrived');
    assert.equal(fixture.calls.length, 0);
  } }),
  it({ name: 'rejects callback after original successful dispatch without replacing retained native completion', fn: async () => {
    const fixture = createCollectorFixture({ memberCount: 1 });
    const [completion] = fixture.completions;
    assert.ok(completion);
    const pending = fixture.invoke();
    completion.resolve('original result');
    assert.equal(await pending, 'original result');
    await fixture.run.drain();
    const [repeated] = await Promise.allSettled([fixture.invoke()]);
    assert.ok(repeated?.status === 'rejected');
    assert.ok(Error.isError(repeated.reason));
    assert.equal(repeated.reason.message, 'Declared member callback cannot be replayed');
    assert.deepEqual(fixture.run.inspect().members[0]?.completion, { status: 'fulfilled', value: 'original result' });
    assert.equal(fixture.calls.length, 1);
  } }),
  it({ name: 'rejects pre-existing native cancellation before ticket and signal allocation', fn: async () => {
    const fixture = createCollectorFixture();
    const [native] = fixture.native;
    assert.ok(native);
    const reason = Object.freeze({ original: 'native cancellation' });
    native.abort(reason);
    const [result] = await Promise.allSettled([fixture.invoke()]);
    assert.deepEqual(result, { status: 'rejected', reason });
    assert.equal(fixture.run.inspect().members[0]?.arrival, 'unarrived');
    assert.equal(fixture.control.parents, 1);
  } }),
  it({ name: 'rejects reentrant collection before its own currentness callbacks can run', fn: async () => {
    const fixture = createCollectorFixture();
    const inner: Promise<unknown>[] = [];
    fixture.control.parent = function reenter(): void {
      if (fixture.control.parents === 1) inner.push(fixture.invoke({ index: 1 }));
    };
    const outer = fixture.invoke();
    const results = await Promise.allSettled([outer, ...inner]);
    assert.equal(results.length, 2);
    assert.equal(results.every(function rejected(result) { return result.status === 'rejected'; }), true);
    const failure = fixture.run.inspect().failure;
    assert.ok(Error.isError(failure));
    assert.equal(failure.message, 'Declared group collection cannot reenter through callbacks');
    assert.equal(fixture.control.parents, 1);
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.run.inspect().members.every(function unarrived(member) { return member.arrival === 'unarrived'; }), true);
  } }),
  it({ name: 'releases the collection guard before synchronous dispatch callbacks reenter', fn: async () => {
    const fixture = createCollectorFixture({ memberCount: 1 });
    const repeated: Promise<unknown>[] = [];
    fixture.control.consume = function reenterConsumer(): unknown {
      repeated.push(fixture.invoke());
      return ['original retained result'];
    };
    const first = fixture.invoke();
    await Promise.allSettled([first, ...repeated]);
    await fixture.run.drain();
    const failure = fixture.run.inspect().failure;
    assert.ok(Error.isError(failure));
    assert.equal(failure.message, 'Declared member callback cannot be replayed');
    assert.deepEqual(fixture.run.inspect().members[0]?.completion, { status: 'fulfilled', value: 'original retained result' });
  } }),
  //endregion
] });
