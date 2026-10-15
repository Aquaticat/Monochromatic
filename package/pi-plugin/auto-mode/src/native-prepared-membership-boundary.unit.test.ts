/**
 Final prepared native membership rejects changed identities and preserves original JSON failure boundaries. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { capturePreparedMembership, membershipNames } from './native-membership-fixture.ts';

await describe({
  name: 'original prepared membership boundaries',
  children: [
    //region Complete frozen group and member identities are required before any publication.
    ...[undefined, null, {}, [], Object.freeze([]), Object.freeze([{}, {}])].map(function invalidGroup(members, ordinal) {
      return it({
        name: `rejects incomplete or mutable prepared group case ${String(ordinal)}`,
        fn: async () => {
          assert.throws(() => capturePreparedMembership({ members, declaredNames: membershipNames(1) }), {
            name: 'JudgmentConstructionError', message: 'Prepared group differs from complete declared membership'
          });
        }
      });
    }),
    ...[
      undefined,
      null,
      { id: 'call-0', name: 'read', input: Object.freeze({}) },
      Object.freeze({ id: 'changed', name: 'read', input: Object.freeze({}) }),
      Object.freeze({ id: 'call-0', name: 'changed', input: Object.freeze({}) }),
      Object.freeze({ id: 'call-0', name: 'read' }),
      Object.freeze({ id: 'call-0', name: 'read', input: {} }),
      Object.freeze(Object.create({ input: Object.freeze({}) }, { id: { value: 'call-0' }, name: { value: 'read' } }))
    ].map(function invalidMember(member: unknown, ordinal) {
      return it({
        name: `rejects changed or unsealed prepared member case ${String(ordinal)}`,
        fn: async () => {
          assert.throws(() => capturePreparedMembership({ members: Object.freeze([member]), declaredNames: membershipNames(1) }), {
            name: 'JudgmentConstructionError', message: 'Prepared member identity or sealed input differs from the native group'
          });
        }
      });
    }),
    //endregion
    //region Original prepared-group JSON limits include serialized member framing.
    it({
      name: 'accepts exactly one MiB and rejects the next prepared byte',
      fn: async () => {
        /** Group framing is measured independently from the production byte-limit constant. */
        const overhead = Buffer.byteLength(JSON.stringify([{ id: 'call-0', name: 'read', input: '' }]));
        /** Exactly bounded input remains immutable across native serialization. */
        const input = 'a'.repeat(1_048_576 - overhead);
        assert.equal(Buffer.byteLength(capturePreparedMembership({
          members: Object.freeze([Object.freeze({ id: 'call-0', name: 'read', input })]), declaredNames: membershipNames(1)
        })), 1_048_576);
        assert.throws(() => capturePreparedMembership({
          members: Object.freeze([Object.freeze({ id: 'call-0', name: 'read', input: `${input}a` })]), declaredNames: membershipNames(1)
        }), { name: 'JudgmentConstructionError', message: 'Prepared member data exceeds the declared JSON profile' });
      }
    }),
    it({
      name: 'rejects absent group serialization after completing member admission',
      fn: async () => {
        /** Original empty group isolates the final serializer's absent-result branch. */
        const members = Object.freeze(Object.defineProperty([], 'toJSON', { value() { 
          return undefined; 
        } }));
        assert.throws(() => capturePreparedMembership({ members, declaredNames: [] }), {
          name: 'JudgmentConstructionError', message: 'Prepared member data exceeds the declared JSON profile'
        });
      }
    }),
    it({
      name: 'retains original input-value validation before final group serialization',
      fn: async () => {
        /** Frozen input can still contain a number that native JSON would silently change. */
        const members = Object.freeze([Object.freeze({ id: 'call-0', name: 'read', input: Object.freeze({ value: -0 }) })]);
        assert.throws(() => capturePreparedMembership({ members, declaredNames: membershipNames(1) }), {
          name: 'JudgmentConstructionError', message: 'Native tool input contains a value not preserved by the declared JSON profile'
        });
      }
    }),
    it({
      name: 'propagates the exact final prepared serializer failure',
      fn: async () => {
        /** Exact failure identity belongs to the native serializer, not membership admission. */
        const failure = new Error('final prepared serialization failed');
        /** Final array serialization is independently observable after all admission checks succeed. */
        const members = Object.freeze(Object.defineProperty([], 'toJSON', { value() { 
          throw failure; 
        } }));
        assert.throws(() => capturePreparedMembership({ members, declaredNames: [] }),
          function originalFailure(error) { 
            return error === failure; 
          });
      }
    })
    //endregion
  ]
});
