/** Original native option spread precedes call lookup and retains opaque callback outcomes. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerBindingFixture } from './native-runner-binding-fixture.ts';

await describe({ name: '', children: [
  //region Original native options retain enumerable content and callback identity while replacing member cancellation.
  it({ name: 'captures native callback once and forwards original member signals in callback call order', fn: async () => {
    const fixture = createRunnerBindingFixture();
    const bound = fixture.bind();
    fixture.input.runner.host.runOwnedToolCall = function replacedNative() { assert.fail('Native callback was not captured'); };
    const admission = fixture.admission();
    for (const call of bound.calls.toReversed()) {
      const options = { original: call.id, signal: new AbortController().signal };
      assert.equal(admission.runNative(call, options), fixture.control.value);
      const observed = fixture.native.at(-1);
      assert.ok(observed);
      assert.equal(observed.call, call);
      assert.notEqual(observed.options, options);
      assert.deepEqual(observed.options, { original: call.id, signal: fixture.input.group.members[bound.ordinals.get(call.id) ?? -1]?.signal });
      assert.equal(Object.hasOwn(options, 'signal'), true);
    }
  } }),
  ...[undefined, null, false, 2, 'a😀', Object.freeze({ retained: true })].map(function opaqueOptions(options) {
    return it({ name: `retains original native spread semantics for ${JSON.stringify(options)}`, fn: async () => {
      const fixture = createRunnerBindingFixture();
      const bound = fixture.bind();
      const [call] = bound.calls;
      assert.ok(call);
      fixture.admission().runNative(call, options);
      const expected = typeof options === 'string' ? { 0: 'a', 1: '\ud83d', 2: '\ude00', signal: fixture.input.group.members[0]?.signal } : { ...(typeof options === 'object' && options !== null ? options : {}), signal: fixture.input.group.members[0]?.signal };
      assert.deepEqual(fixture.native[0]?.options, expected);
    } });
  }),
  it({ name: 'evaluates original option getters before call identity and preserves enumerable symbols', fn: async () => {
    const fixture = createRunnerBindingFixture();
    const bound = fixture.bind();
    const [original] = bound.calls;
    assert.ok(original);
    const observed: string[] = [];
    const key = Symbol('original native option');
    const options: unknown = Object.create({ inherited: true }, {
      visible: { enumerable: true, get() { observed.push('visible'); return 'retained'; } },
      signal: { enumerable: true, get() { observed.push('signal'); return 'replaced'; } },
      hidden: { enumerable: false, value: 'not copied' },
      [key]: { enumerable: true, get() { observed.push('symbol'); return original; } },
    });
    const call = { ...original, get id(): string { observed.push('id'); return original.id; } };
    fixture.admission().runNative(call, options);
    assert.deepEqual(observed, ['visible', 'signal', 'symbol', 'id']);
    assert.deepEqual(fixture.native[0]?.options, { visible: 'retained', signal: fixture.input.group.members[0]?.signal, [key]: original });
  } }),
  ...['option-getter', 'call-getter', 'native'].map(function originalFailure(point) {
    return it({ name: `preserves opaque ${point} failure and stops subsequent original callbacks`, fn: async () => {
      const fixture = createRunnerBindingFixture();
      const bound = fixture.bind();
      const [original] = bound.calls;
      assert.ok(original);
      const failure = Object.freeze({ original: point });
      const observed: string[] = [];
      const options = { get value(): unknown { observed.push('options'); if (point === 'option-getter') throw failure; return undefined; } };
      const call = { ...original, get id(): string { observed.push('id'); if (point === 'call-getter') throw failure; return original.id; } };
      fixture.control.failAt = 'native';
      fixture.control.failure = failure;
      assert.throws(function failNative() { fixture.admission().runNative(call, options); }, function originalError(error: unknown) { return error === failure; });
      assert.deepEqual(observed, point === 'option-getter' ? ['options'] : ['options', 'id']);
      assert.equal(fixture.native.length, point === 'native' ? 1 : 0);
    } });
  }),
  //endregion
] });
