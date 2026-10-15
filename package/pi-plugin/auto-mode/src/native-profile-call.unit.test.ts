/**
 Built call inspection retains original source text and private pattern ownership. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { inspect, parseCall, patterns, syntheticCall } from './native-profile-call-fixture.ts';

await describe({ name: 'original profile call values', children: [
  //region Original parser and decoder ownership preserve complete source values.
  it({ name: 'retains source spans, original pattern ownership, positions, and frozen envelopes', fn: async function values() {
    const source = 'tools.\\u0074ool({text:"\\\"; </script> ../ $(x) 😀", nested:[null,true,-2]})';
    const prefix = '   ';
    const call = parseCall(prefix + source);
    const result = inspect({ call, source, prefix });
    assert.equal(result.group, 2);
    assert.equal(result.ordinal, 3);
    assert.equal(result.name, 'tool');
    assert.equal(result.alias, '__owned_flow_2_3');
    assert.deepEqual(result.callee, { start: 0, end: 15, text: 'tools.\\u0074ool' });
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.callee));
    assert.deepEqual(patterns.materializePattern({ pattern: result.pattern }), {
      text: '"; </script> ../ $(x) 😀', nested: [null, true, -2],
    });
    assert.equal(Object.isFrozen(call), false);
  } }),
  it({ name: 'retains the exact earlier binding and original decoder error class', fn: async function binding() {
    const source = 'tools.tool({value: previous})';
    const result = inspect({ call: parseCall(source), source, bindingName: 'previous' });
    assert.deepEqual(patterns.materializePattern({ pattern: result.pattern, result: 'native result' }), { value: 'native result' });
    assert.throws(function absentBinding() {
      inspect({ call: parseCall(source), source });
    }, patterns.ResultProgramProfileError);
  } }),
  it({ name: 'forwards the exact argument and binding before constructing the source envelope', fn: async function ownership() {
    const argument = { original: true };
    const pattern = { originalPattern: true };
    const events: string[] = [];
    const call = { type: 'CallExpression', optional: false, arguments: [argument], callee: {
      type: 'MemberExpression', computed: false, optional: false,
      object: { type: 'Identifier', name: 'tools' },
      property: { type: 'Identifier', get name() { events.push('name'); return 'tool'; } },
      get start() { events.push('start'); return 0; },
      get end() { events.push('end'); return 10; },
    } };
    const result = inspect({ call, bindingName: 'bound', readPattern(input: unknown) {
      assert.deepEqual(input, { node: argument, bindingName: 'bound' });
      assert.ok(input !== null && typeof input === 'object' && 'node' in input);
      assert.equal(input.node, argument);
      events.push('pattern');
      return pattern;
    } });
    assert.equal(result.pattern, pattern);
    assert.equal(Object.isFrozen(pattern), false);
    assert.deepEqual(events, ['name', 'start', 'end', 'name', 'pattern']);
  } }),
  it({ name: 'preserves fractional end positions admitted by the original span predicate', fn: async function fractionalEnd() {
    assert.doesNotThrow(function originalFractionalEnd() {
      const result = inspect({ call: syntheticCall({ end: 9.5 }), readPattern() { return {}; } });
      assert.deepEqual(result.callee, { start: 0, end: 9.5, text: 'tools.too' });
    });
  } }),
  it({ name: 'passes an argument-array hole to the original decoder without inventing a node', fn: async function hole() {
    const call = { ...syntheticCall(), arguments: Array.from({ length: 1 }) };
    assert.throws(function originalHole() { inspect({ call }); }, patterns.ResultProgramProfileError);
    assert.doesNotThrow(function observedHole() {
      inspect({ call, readPattern(input: unknown) {
        assert.deepEqual(input, { node: undefined, bindingName: undefined });
        return {};
      } });
    });
  } }),
  //endregion
] });
