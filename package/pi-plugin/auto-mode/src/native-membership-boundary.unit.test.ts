/**
 Native response membership retains original JSON size, value-preservation, and serializer failure boundaries. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { captureMembership } from './native-membership-fixture.ts';

await describe({
  name: 'original response JSON boundaries',
  children: [
    //region Native byte bounds and JSON container checks precede declared membership publication.
    it({
      name: 'accepts an exactly bounded response and rejects the next byte',
      fn: async () => {
        /** Finite fixture calibrates native JSON overhead independently of production constants. */
        const call = { type: 'toolCall', id: 'a', name: 'read', arguments: { text: '' } };
        /** Serialized framing bytes must count toward the same original response bound. */
        const overhead = Buffer.byteLength(JSON.stringify([call]));
        call.arguments.text = 'a'.repeat(1_048_576 - overhead);
        assert.equal(Buffer.byteLength(captureMembership({ content: [call] }).parentJSON), 1_048_576);
        call.arguments.text += 'a';
        assert.throws(() => captureMembership({ content: [call] }), {
          name: 'JudgmentConstructionError', message: 'Native enclosing response exceeds the declared JSON profile'
        });
      }
    }),
    ...[{}, null, 'text', 1].map(function nonArrayContent(value, ordinal) {
      return it({
        name: `rejects non-array serialized response case ${String(ordinal)}`,
        fn: async () => {
          /** A native array can still serialize through a caller-owned projection callback. */
          const content = Object.defineProperty([], 'toJSON', { value() { 
            return value; 
          } });
          assert.throws(() => captureMembership({ content }), {
            name: 'JudgmentConstructionError', message: 'Native enclosing response has no content array'
          });
        }
      });
    }),
    it({
      name: 'rejects absent serialization before parsing the declared response',
      fn: async () => {
        /** Undefined serializer output is distinct from a JSON scalar or empty membership. */
        const content = Object.defineProperty([], 'toJSON', { value() { 
          return undefined; 
        } });
        assert.throws(() => captureMembership({ content }), {
          name: 'JudgmentConstructionError', message: 'Native enclosing response exceeds the declared JSON profile'
        });
      }
    }),
    //endregion
    //region Every native tool argument retains the original JSON preservation checks.
    ...[undefined, Number.NaN, Number.POSITIVE_INFINITY, -0].map(function lostInput(value, ordinal) {
      return it({
        name: `rejects a non-preserved native argument case ${String(ordinal)}`,
        fn: async () => {
          assert.throws(() => captureMembership({ content: [{ type: 'toolCall', id: 'a', name: 'read', arguments: { value } }] }), {
            name: 'JudgmentConstructionError', message: 'Native tool input contains a value not preserved by the declared JSON profile'
          });
        }
      });
    }),
    it({
      name: 'propagates the exact native serializer failure before publishing membership',
      fn: async () => {
        /** Original serializer error must survive without wrapping or substitution. */
        const failure = new Error('original serializer failure');
        /** Native argument serialization is the first observable response operation after content iteration. */
        const input = { toJSON() { 
          throw failure; 
        } };
        assert.throws(() => captureMembership({ content: [{ type: 'toolCall', id: 'a', name: 'read', arguments: input }] }),
          function originalFailure(error) { 
            return error === failure; 
          });
      }
    }),
    it({
      name: 'propagates native cyclic response serialization failure after validating ordinary tool arguments',
      fn: async () => {
        /** Cyclic non-tool content isolates enclosing serialization from tool argument admission. */
        const content: unknown[] = [{ type: 'toolCall', id: 'a', name: 'read', arguments: {} }];
        content.push({ type: 'text', cycle: content });
        assert.throws(() => captureMembership({ content }), TypeError);
      }
    })
    //endregion
  ]
});
