/** Original native arrival preserves cancellation replay, listener guards, and retained outcomes. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { awaitCollectorResult, createCollectorFixture, originalCollectorAbortListener } from './native-group-collector-fixture.ts';

await describe({ name: '', children: [
  //region Parent, native, and collector cancellation preserve original transport and native lifetimes.
  ...['parent', 'native'].map(function directSignal(source) {
    return it({ name: `retains direct ${source} signal membership before failure callbacks run`, fn: async () => {
      const fixture = createCollectorFixture({ memberCount: 1 });
      const pending = Promise.allSettled([fixture.invoke()]);
      const [call] = fixture.calls;
      const [member] = call?.members ?? [];
      const [native] = fixture.native;
      const [completion] = fixture.completions;
      assert.ok(member);
      assert.ok(native);
      assert.ok(completion);
      const controller = source === 'parent' ? fixture.parent : native;
      const listener = originalCollectorAbortListener(controller.signal);
      controller.signal.removeEventListener('abort', listener);
      const reason = Object.freeze({ original: source });
      controller.abort(reason);
      assert.equal(member.signal.aborted, true);
      assert.equal(member.signal.reason, reason);
      assert.equal(fixture.run.inspect().failed, false);
      fixture.run.retire();
      completion.resolve('original late completion');
      await awaitCollectorResult(pending);
      await awaitCollectorResult(fixture.run.drain());
    } });
  }),
  ...['parent', 'native', 'retire'].map(function cancellationSource(source) {
    return it({ name: `combines ${source} cancellation while retaining issued native outcomes`, fn: async () => {
      const fixture = createCollectorFixture();
      const pending = Promise.allSettled([fixture.invoke(), fixture.invoke({ index: 1 })]);
      const [call] = fixture.calls;
      assert.ok(call);
      assert.equal(call.members.every(function active(member) { 
        return !member.signal.aborted; 
      }), true);
      const reason = Object.freeze({ original: source });
      if (source === 'parent') fixture.parent.abort(reason);
      if (source === 'native') {
        const [native] = fixture.native;
        assert.ok(native);
        native.abort(reason);
      }
      if (source === 'retire') fixture.run.retire();
      const results = await awaitCollectorResult(pending);
      assert.equal(results.every(function rejected(result) { 
        return result.status === 'rejected'; 
      }), true);
      const [first] = results;
      assert.ok(first?.status === 'rejected');
      if (source !== 'retire') assert.equal(first.reason, reason);
      assert.deepEqual(results[1], first);
      assert.equal(call.members.every(function cancelled(member) { 
        return member.signal.aborted; 
      }), true);
      for (const member of call.members) assert.equal(member.signal.reason, first.reason);
      const [firstCompletion, secondCompletion] = fixture.completions;
      assert.ok(firstCompletion);
      assert.ok(secondCompletion);
      const retained = Object.freeze({ original: 'late native value' });
      firstCompletion.resolve(retained);
      secondCompletion.reject(undefined);
      await awaitCollectorResult(fixture.run.drain());
      const snapshot = fixture.run.inspect();
      assert.deepEqual(snapshot.members.map(function completion(member) { 
        return member.completion; 
      }), [
        { status: 'fulfilled', value: retained }, { status: 'rejected', reason: undefined },
      ]);
      assert.equal(snapshot.members.every(function terminal(member) { 
        return member.state === (source === 'retire' ? 'cancelled' : 'rejected'); 
      }), true);
      assert.equal(snapshot.phase, source === 'retire' ? 'closed' : 'failed');
    } });
  }),
  it({ name: 'replays native cancellation published by the final parent-reader callback', fn: async () => {
    const fixture = createCollectorFixture();
    const [native] = fixture.native;
    assert.ok(native);
    const reason = Object.freeze({ original: 'cancelled during final currentness' });
    fixture.control.read = function cancelBeforeListener(): void {
      if (fixture.control.reads === 3) native.abort(reason);
    };
    const result = await Promise.race([Promise.allSettled([fixture.invoke()]), setImmediate('missing-cancellation-replay')]);
    assert.deepEqual(result, [{ status: 'rejected', reason }]);
    assert.equal(fixture.run.inspect().members[0]?.arrival, 'matched');
    assert.equal(fixture.run.inspect().members[0]?.state, 'rejected');
    assert.equal(fixture.calls.length, 0);
  } }),
  it({ name: 'manually rechecks parent cancellation after native listener installation', fn: async () => {
    const fixture = createCollectorFixture();
    const [native] = fixture.native;
    assert.ok(native);
    const parentListener = originalCollectorAbortListener(fixture.parent.signal);
    fixture.parent.signal.removeEventListener('abort', parentListener);
    const addListener = native.signal.addEventListener.bind(native.signal);
    const reason = Object.freeze({ original: 'cancelled while installing native listener' });
    Object.defineProperty(native.signal, 'addEventListener', { value(type: string, listener: EventListener, options: AddEventListenerOptions): void {
      addListener(type, listener, options);
      fixture.parent.abort(reason);
    } });
    const result = await Promise.race([Promise.allSettled([fixture.invoke()]), setImmediate('missing-parent-replay')]);
    assert.deepEqual(result, [{ status: 'rejected', reason }]);
    assert.equal(fixture.run.inspect().members[0]?.arrival, 'matched');
    assert.equal(fixture.calls.length, 0);
  } }),
  it({ name: 'rejects the allocated ticket when listener installation fails', fn: async () => {
    const fixture = createCollectorFixture();
    const [native] = fixture.native;
    assert.ok(native);
    const failure = new Error('original listener installation failed');
    Object.defineProperty(native.signal, 'addEventListener', { value(): never { 
      throw failure; 
    } });
    const result = await Promise.race([Promise.allSettled([fixture.invoke()]), setImmediate('missing-pending-rejection')]);
    assert.deepEqual(result, [{ status: 'rejected', reason: failure }]);
    assert.equal(fixture.run.inspect().members[0]?.arrival, 'matched');
    assert.equal(fixture.run.inspect().members[0]?.state, 'rejected');
    assert.equal(fixture.calls.length, 0);
  } }),
  it({ name: 'installs the original native listener once and removes that exact callback at retirement', fn: async () => {
    const fixture = createCollectorFixture();
    const [native] = fixture.native;
    assert.ok(native);
    const addListener = native.signal.addEventListener.bind(native.signal);
    const removeListener = native.signal.removeEventListener.bind(native.signal);
    const installed: EventListener[] = [];
    const removed: EventListener[] = [];
    Object.defineProperty(native.signal, 'addEventListener', { value(type: string, listener: EventListener, options: AddEventListenerOptions): void {
      assert.equal(type, 'abort');
      assert.deepEqual(options, { once: true });
      installed.push(listener);
      addListener(type, listener, options);
    } });
    Object.defineProperty(native.signal, 'removeEventListener', { value(type: string, listener: EventListener): void {
      assert.equal(type, 'abort');
      removed.push(listener);
      removeListener(type, listener);
    } });
    const pending = Promise.allSettled([fixture.invoke()]);
    assert.equal(installed.length, 1);
    assert.equal(originalCollectorAbortListener(native.signal), installed[0]);
    fixture.run.retire();
    await awaitCollectorResult(pending);
    assert.deepEqual(removed, installed);
  } }),
  //endregion
  //region Captured original listeners demonstrate each guard after native event detachment.
  ...['closed', 'settled', 'completed'].map(function listenerGuard(guard) {
    return it({ name: `ignores retained native callback after ${guard}`, fn: async () => {
      const fixture = createCollectorFixture();
      const pending = Promise.allSettled([fixture.invoke(), fixture.invoke({ index: 1 })]);
      const [native] = fixture.native;
      assert.ok(native);
      const listener = originalCollectorAbortListener(native.signal);
      const [first, second] = fixture.completions;
      assert.ok(first);
      assert.ok(second);
      if (guard === 'closed') fixture.run.retire();
      else {
        first.resolve(null);
        if (guard === 'settled') second.resolve(undefined);
        await setImmediate();
      }
      const before = fixture.run.inspect();
      listener();
      assert.deepEqual(fixture.run.inspect(), before);
      first.resolve(null);
      second.resolve(undefined);
      await awaitCollectorResult(pending);
      await awaitCollectorResult(fixture.run.drain());
    } });
  }),
  it({ name: 'releases reentry protection on admission failure before the next original callback', fn: async () => {
    const fixture = createCollectorFixture();
    const first = await awaitCollectorResult(Promise.allSettled([fixture.invoke({ signal: null })]));
    const again = await awaitCollectorResult(Promise.allSettled([fixture.invoke()]));
    assert.deepEqual(again, first);
    assert.equal(fixture.run.inspect().failures.length, 1);
  } }),
  //endregion
] });
