/**
 Original combinator and collection admission reject before member inspection. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { inspectSuccessors, rejects, returnedGroup } from './native-profile-successors-fixture.ts';

await describe({ name: 'original successor rejection', children: [
  //region Syntax independently exercises each original combinator guard.
  ...[
    'Promise.all', 'Promise.all?.([])', 'Promise[all]([])', 'Promise?.all([])',
    '({}).all([])', 'Other.all([])', 'Promise["all"]([])', 'Promise.race([])',
    'Promise.all()', 'Promise.all([], [])', 'Promise.allSettled()', 'Promise.allSettled([], [])',
    'all([])', 'null',
  ].map(function invalidCombinator(source) {
    return it({ name: `rejects combinator ${source}`, fn: async function rejectedCombinator() {
      rejects({ source, message: 'native parallel combinator required' });
    } });
  }),
  ...['Promise.all({})', 'Promise.all([])', `Promise.all([${Array.from({ length: 33 }, function member() { 
    return 'tools.tool({})'; 
  }).join(',')}])`].map(function invalidCollection(source) {
    return it({ name: `rejects collection ${source}`, fn: async function rejectedCollection() {
      rejects({ source, message: 'complete successor member array required' });
    } });
  }),
  ...['Promise.all([,])', 'Promise.all([...items])', 'Promise.all([result])'].map(function invalidMember(source) {
    return it({ name: `delegates member rejection ${source}`, fn: async function rejectedMember() {
      rejects({ source, message: 'direct single-argument call required' });
    } });
  }),
  it({ name: 'uses the exact borrowed allowed membership and binding', fn: async function borrowedState() {
    rejects({ input: { allowed: new Set() }, message: 'owned tool identifier required' });
    rejects({ input: { declaration: { id: { name: 'other' } } }, message: 'unbound shorthand' });
  } }),
  //endregion
  //region Synthetic syntax isolates collection admission, null handling, and rejection ordering.
  it({ name: 'isolates each original node and static member guard', fn: async function isolatedGuards() {
    const callee = { type: 'MemberExpression', computed: false, optional: false,
      object: { type: 'Identifier', name: 'Promise' }, property: { type: 'Identifier', name: 'all' } };
    for (const input of [
      { type: 'NewExpression' },
      { callee: { ...callee, type: 'Identifier' } },
      { callee: { ...callee, optional: true } },
      { callee: { ...callee, object: { type: 'Literal', name: 'Promise' } } },
      { callee: { ...callee, property: { type: 'Literal', name: 'all' } } },
    ]) {
      rejects({ input: { returned: returnedGroup(input) }, message: 'native parallel combinator required' });
    }
    rejects({ input: { returned: returnedGroup({ arguments: [{ type: 'ObjectExpression', elements: [{}] }] }) },
      message: 'complete successor member array required' });
  } }),
  it({ name: 'rejects nonfinite and empty collection lengths before mapping', fn: async function invalidLength() {
    for (const length of [0, -1, 33, Number.NaN, Number.POSITIVE_INFINITY]) {
      let mapped = false;
      rejects({ input: { returned: returnedGroup({ arguments: [{ type: 'ArrayExpression', elements: { length, map() {
        mapped = true;
        return [];
      } } }] }) }, message: 'complete successor member array required' });
      assert.equal(mapped, false);
    }
  } }),
  it({ name: 'retains native missing-expression and missing-array type errors', fn: async function missingNodes() {
    for (const returned of [{ argument: {} }, { argument: { argument: null } }, returnedGroup({ arguments: [undefined] })]) {
      assert.throws(function missingNode() { 
        inspectSuccessors({ input: { returned } }); 
      }, TypeError);
    }
  } }),
  it({ name: 'rejects an absent member through the original profile constructor', fn: async function absentMember() {
    rejects({ input: { returned: returnedGroup({ callee: undefined }) }, message: 'native parallel combinator required' });
  } }),
  it({ name: 'uses the borrowed constructor before reading invalid group members', fn: async function rejectionOrder() {
    class OriginalFailureError extends Error { override name = 'OriginalFailureError'; }
    const inspected: boolean[] = [];
    assert.throws(function originalConstructor() {
      inspectSuccessors({ input: { returned: returnedGroup({ optional: true }), ResultProgramProfileError: OriginalFailureError, inspectCall() {
        inspected.push(true);
        throw new Error('unexpected inspection');
      } } });
    }, { constructor: OriginalFailureError, message: 'native parallel combinator required' });
    assert.deepEqual(inspected, []);
    assert.throws(function collectionConstructor() {
      inspectSuccessors({ source: 'Promise.all([])', input: { ResultProgramProfileError: OriginalFailureError } });
    }, { constructor: OriginalFailureError, message: 'complete successor member array required' });
  } }),
  //endregion
] });
