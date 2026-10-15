/**
 Original call admission preserves failure order and diagnostic identity. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { inspect, parseCall, patterns, syntheticCall } from './native-profile-call-fixture.ts';

/**
 Require the exact original diagnostic, including its constructor identity.

 @param input - original malformed call fixture

 @param message - independently expected original profile failure
 */
function rejects({ input, message }: Readonly<{ input: Readonly<Record<string, unknown>>; message: string }>): void {
  assert.throws(function rejectedCall() { 
    inspect(input); 
  }, {
    constructor: patterns.ResultProgramProfileError,
    name: 'ResultProgramProfileError',
    message: `Result-derived program is outside the inspected profile: ${message}`,
  });
}

await describe({ name: 'original profile call admission', children: [
  //region Call admission precedes member access and original argument decoding.
  ...[undefined, null, {}, { type: 'Identifier' },
    { type: 'CallExpression', optional: true },
    { type: 'CallExpression', arguments: [] },
    { type: 'CallExpression', arguments: [{}, {}] },
  ].map(function invalidCall(call, ordinal) {
    return it({ name: `rejects original call shape ${ordinal}`, fn: async function rejectShape() {
      rejects({ input: { call, readPattern: undefined }, message: 'direct single-argument call required' });
    } });
  }),
  ...['tool({})', 'tools["tool"]({})', 'other.tool({})', 'tools.unknown({})', 'tools.tool.call({})'].map(function invalidMember(source) {
    return it({ name: `rejects original callee ${source}`, fn: async function rejectMember() {
      rejects({ input: { call: parseCall(source), source, readPattern: undefined }, message: 'owned tool identifier required' });
    } });
  }),
  it({ name: 'rejects optional original member access before property reads', fn: async function optionalMember() {
    rejects({ input: { call: syntheticCall({ optional: true, object: undefined }) }, message: 'owned tool identifier required' });
  } }),
  it({ name: 'rejects non-identifier member properties before membership lookup', fn: async function property() {
    rejects({ input: { call: syntheticCall({ property: { type: 'PrivateIdentifier', name: 'tool' } }), allowed: undefined }, message: 'owned tool identifier required' });
  } }),
  ...[
    { start: -1 }, { start: 0.5 }, { start: Number.NaN }, { start: Infinity },
    { start: 10 }, { end: 0 }, { end: 100 }, { end: Number.NaN }, { end: Infinity },
  ].map(function invalidSpan(span, ordinal) {
    return it({ name: `rejects original source bounds ${ordinal}`, fn: async function rejectSpan() {
      rejects({ input: { call: syntheticCall(span), readPattern: undefined }, message: 'callee source span' });
    } });
  }),
  it({ name: 'preserves opaque membership, node getter, and original decoder failures', fn: async function opaqueFailure() {
    const failure: unknown = Object.freeze({ reason: 'original inspection failure' });
    for (const input of [
      { allowed: { has() { 
        throw failure; 
      } } },
      { call: { get type() { 
        throw failure; 
      } } },
      { readPattern() { 
        throw failure; 
      } },
    ]) {
      assert.throws(function originalFailure() { 
        inspect(input); 
      }, function sameFailure(error: unknown) {
        assert.equal(error, failure);
        return true;
      });
    }
  } }),
  //endregion
] });
