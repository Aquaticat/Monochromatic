/**
 Original profile rejection guards retain diagnostic identity and order. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { decode, objectNode, parseArgument, rejects } from './native-pattern-decoder-fixture.ts';

await describe({ name: 'original pattern rejection', children: [
  //region Reject unsupported literals and preserve original bounded recursion.
  ...[undefined, null, {}, { type: 'Identifier', name: 'other' }, { type: 'Identifier', name: 'result' },
    { type: 'UnaryExpression', operator: '+', argument: { type: 'Literal', value: 1 } },
    { type: 'UnaryExpression', operator: '-', argument: { type: 'Identifier', value: 1 } },
    { type: 'UnaryExpression', operator: '-', argument: { type: 'Literal', value: '1' } },
    { type: 'UnaryExpression', operator: '-', argument: null },
  ].map(function unsupported(node, ordinal) {
    return it({ name: `rejects unsupported syntax ${ordinal}`, fn: async function unsupportedNode() {
      rejects({ input: { node }, message: 'literal object or earlier result reference required' });
    } });
  }),
  it({ name: 'rejects wrong binding identity even when another binding exists', fn: async function binding() {
    rejects({ input: { node: parseArgument('other'), bindingName: 'result' }, message: 'literal object or earlier result reference required' });
  } }),
  ...[undefined, {}, [], 1n, Number.NaN, Infinity, -Infinity, -0].map(function nonJson(value, ordinal) {
    return it({ name: `rejects non-JSON literal value ${ordinal}`, fn: async function literalValue() {
      rejects({ input: { node: { type: 'Literal', value } }, message: 'non-JSON literal' });
    } });
  }),
  ...[{ regex: {} }, { bigint: '0' }].map(function metadata(fields, ordinal) {
    return it({ name: `rejects literal metadata ${ordinal}`, fn: async function literalMetadata() {
      rejects({ input: { node: { type: 'Literal', value: 1, ...fields } }, message: 'non-JSON literal' });
    } });
  }),
  ...[0, Number.NaN, Infinity, -Infinity].map(function unary(value, ordinal) {
    return it({ name: `rejects non-JSON unary number ${ordinal}`, fn: async function unaryNumber() {
      rejects({ input: { node: { type: 'UnaryExpression', operator: '-', argument: { type: 'Literal', value } } }, message: 'non-JSON number' });
    } });
  }),
  it({ name: 'rejects original depth overflow before accessing input and rejects excessive child depth', fn: async function depth() {
    for (const value of [9, Number.NaN, Infinity]) rejects({ input: { depth: value, node: undefined }, message: 'argument nesting exceeds profile' });
    rejects({ input: { node: parseArgument(`${'['.repeat(9)}0${']'.repeat(9)}`) }, message: 'argument nesting exceeds profile' });
  } }),
  it({ name: 'rejects excessive and nonnumeric lengths before inspecting collection contents', fn: async function collections() {
    for (const length of [65, Number.NaN, Infinity]) {
      rejects({ input: { node: { type: 'ArrayExpression', elements: { length } } }, message: 'array size bound' });
      rejects({ input: { node: { type: 'ObjectExpression', properties: { length } } }, message: 'literal object or earlier result reference required' });
    }
    rejects({ input: { node: parseArgument('[,]') }, message: 'array hole or spread' });
    rejects({ input: { node: parseArgument('[...value]') }, message: 'array hole or spread' });
    assert.throws(function undefinedElement() { decode({ node: { type: 'ArrayExpression', elements: [undefined] } }); }, TypeError);
  } }),
  //endregion
  //region Data properties reject computation, duplicate keys, and unbound shorthand separately.
  ...[{ type: 'SpreadElement' }, { computed: true }, { method: true }, { kind: 'get' }, { kind: 'set' }].map(function property(input, ordinal) {
    return it({ name: `rejects unsupported property ${ordinal}`, fn: async function propertyShape() {
      rejects({ input: { node: objectNode(input) }, message: 'ordinary data property required' });
    } });
  }),
  ...['{ 0: 1 }', '{ __proto__: null }', String.raw`{ "__pr\u006fto__": 1 }`, '{ a: 1, "a": 2 }', String.raw`{ a: 1, "\u0061": 2 }`].map(function key(source) {
    return it({ name: `rejects original unsupported key ${source}`, fn: async function keyShape() {
      rejects({ input: { node: parseArgument(source) }, message: 'duplicate, prototype-setting or unsupported key' });
    } });
  }),
  it({ name: 'rejects unsupported key types and all original unbound shorthand paths', fn: async function shorthand() {
    rejects({ input: { node: objectNode({ key: { type: 'PrivateIdentifier', name: 'x' } }) }, message: 'duplicate, prototype-setting or unsupported key' });
    for (const input of [
      { node: objectNode({ shorthand: true, value: { type: 'Identifier', name: 'result' } }) },
      { node: objectNode({ shorthand: true, value: { type: 'Literal', name: 'result', value: 1 } }), bindingName: 'result' },
      { node: objectNode({ shorthand: true, value: { type: 'Identifier', name: 'other' } }), bindingName: 'result' },
    ]) rejects({ input, message: 'unbound shorthand' });
  } }),
  //endregion
] });
