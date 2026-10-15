/**
 Built consumers preserve accepted original patterns and collection boundaries. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { decode, parseArgument } from './native-pattern-decoder-fixture.ts';
import { patterns } from './native-profile-call-fixture.ts';

await describe({ name: 'original pattern decoding', children: [
  //region Finite data and original binding identity remain inert.
  ...[null, true, false, 0, 3.5, -2.25, '"</script>\\\n../$(x);😀'].map(function literal(value, ordinal) {
    return it({ name: `decodes original finite literal ${ordinal}`, fn: async function finiteLiteral() {
      const node = parseArgument(JSON.stringify(value));
      assert.deepEqual(decode({ node }), { kind: 'literal', value });
      const pattern = patterns.readPattern({ node });
      assert.equal(patterns.materializePattern({ pattern }), value);
      assert.ok(Object.isFrozen(pattern));
      assert.equal(Object.isFrozen(node), false);
    } });
  }),
  it({ name: 'preserves nested private ownership, binding references, shorthand, and inert keys', fn: async function nestedData() {
    const node = parseArgument('{ result, text: [result, { "</script>../$(x)": "safe" }], "😀": true }');
    const pattern = patterns.readPattern({ node, bindingName: 'result' });
    const value = patterns.materializePattern({ pattern, result: 'owned output' });
    assert.deepEqual(value, { result: 'owned output', text: ['owned output', { '</script>../$(x)': 'safe' }], '😀': true });
    assert.ok(Object.isFrozen(value));
    const decoded = decode({ node, bindingName: 'result' });
    assert.equal(decoded.kind, 'object');
    assert.ok(Object.isFrozen(decoded));
  } }),
  it({ name: 'accepts original inclusive collection and nesting bounds', fn: async function bounds() {
    const array = decode({ node: parseArgument(`[${Array.from({ length: 64 }, function item() { return '0'; }).join(',')}]`) });
    assert.ok(array.kind === 'array');
    assert.equal(array.items.length, 64);
    assert.ok(Object.isFrozen(array.items));
    const object = decode({ node: parseArgument(`{${Array.from({ length: 64 }, function field(_value, index) { return `key${index}:0`; }).join(',')}}`) });
    assert.ok(object.kind === 'object');
    assert.equal(object.entries.length, 64);
    assert.ok(Object.isFrozen(object.entries));
    assert.ok(object.entries.every(function frozen(entry) { return Object.isFrozen(entry); }));
    assert.doesNotThrow(function inclusiveDepth() { decode({ node: parseArgument(`${'['.repeat(8)}0${']'.repeat(8)}`) }); });
    assert.deepEqual(decode({ node: parseArgument('null'), depth: -1 }), { kind: 'literal', value: null });
    assert.deepEqual(decode({ node: parseArgument('null'), depth: 7.5 }), { kind: 'literal', value: null });
  } }),
  it({ name: 'retains empty structures and synthetic sparse array mapping', fn: async function sparseArray() {
    assert.deepEqual(decode({ node: parseArgument('[]') }), { kind: 'array', items: [] });
    assert.deepEqual(decode({ node: parseArgument('{}') }), { kind: 'object', entries: [] });
    const elements = Array.from({ length: 3 }, function item() { return { type: 'Literal', value: 2 }; });
    Reflect.deleteProperty(elements, '1');
    const result = decode({ node: { type: 'ArrayExpression', elements } });
    assert.ok(result.kind === 'array');
    assert.equal(result.items.length, 3);
    assert.equal(Object.hasOwn(result.items, '1'), false);
    assert.deepEqual(result.items[2], { kind: 'literal', value: 2 });
    assert.ok(Object.isFrozen(result.items));
    assert.equal(Object.isFrozen(elements), false);
  } }),
  it({ name: 'accepts escaped binding names and falsy literal metadata without added restrictions', fn: async function originalMetadata() {
    assert.deepEqual(decode({ node: parseArgument('res\\u0075lt'), bindingName: 'result' }), { kind: 'result' });
    for (const value of [undefined, null, false, 0, '', Number.NaN]) {
      assert.deepEqual(decode({ node: { type: 'Literal', value: 1, regex: value, bigint: value } }), { kind: 'literal', value: 1 });
    }
    assert.deepEqual(decode({ node: parseArgument('-1e308') }), { kind: 'literal', value: -1e308 });
  } }),
  //endregion
] });
