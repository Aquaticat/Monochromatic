/**
 Final prepared-group snapshots preserve original membership order, frozen input, and native serialization. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { capturePreparedMembership, membershipNames } from './native-membership-fixture.ts';

await describe({
  name: 'original prepared native membership',
  children: [
    //region Original identities and every frozen input are checked before native serialization.
    it({
      name: 'preserves complete original member order and serializer callback order',
      fn: async () => {
        /** Original metadata is independently frozen before the built owner receives it. */
        const declaredNames = membershipNames(2);
        /** Serializer events distinguish complete identity validation from subsequent JSON traversal. */
        const events: string[] = [];
        /** Frozen accessor inputs preserve the original callback contract without replacing serialization. */
        const members = Object.freeze(declaredNames.map(function preparedMember(identity) {
          /** Each input remains independently frozen while recording original serializer calls. */
          const input = Object.freeze({ toJSON() { events.push(`json:${identity.id}`); return { path: `${identity.id}.txt` }; } });
          return Object.freeze({
            get id() { events.push(`id:${identity.id}`); return identity.id; },
            get name() { events.push(`name:${identity.id}`); return identity.name; },
            get input() { events.push(`input:${identity.id}`); return input; }
          });
        }));
        /** Native prepared snapshot retains the same serialized identities and materialized arguments. */
        const serialized = capturePreparedMembership({ members, declaredNames });
        assert.deepEqual(JSON.parse(serialized), [
          { id: 'call-0', name: 'read', input: { path: 'call-0.txt' } },
          { id: 'call-1', name: 'read', input: { path: 'call-1.txt' } }
        ]);
        assert.deepEqual(events, [
          'id:call-0', 'name:call-0', 'input:call-0', 'id:call-1', 'name:call-1', 'input:call-1',
          'input:call-0', 'json:call-0', 'input:call-1', 'json:call-1',
          'id:call-0', 'name:call-0', 'input:call-0', 'json:call-0',
          'id:call-1', 'name:call-1', 'input:call-1', 'json:call-1'
        ]);
      }
    }),
    it({
      name: 'finishes complete identity validation before invoking any input serializer',
      fn: async () => {
        /** Later invalid identity must take precedence over an earlier input serializer failure. */
        const declaredNames = membershipNames(2);
        /** Callback counter distinguishes eager input serialization from original full identity validation. */
        const events: string[] = [];
        /** A throwing serializer is never invoked while later group identity remains invalid. */
        const input = Object.freeze({ toJSON() { events.push('serialized'); throw new Error('unexpected serialization'); } });
        /** Frozen group differs only at its final declared identifier. */
        const members = Object.freeze([
          Object.freeze({ id: 'call-0', name: 'read', input }),
          Object.freeze({ id: 'changed', name: 'read', input: Object.freeze({}) })
        ]);
        assert.throws(() => capturePreparedMembership({ members, declaredNames }), {
          name: 'JudgmentConstructionError', message: 'Prepared member identity or sealed input differs from the native group'
        });
        assert.deepEqual(events, []);
      }
    }),
    //endregion
    //region Original native JSON behavior is retained without adding structural input admission.
    ...[null, 'text', true, 0].map(function preservedPrimitive(input, ordinal) {
      return it({
        name: `retains original primitive input acceptance case ${String(ordinal)}`,
        fn: async () => {
          /** Primitive freezing and native JSON behavior belong to the unchanged original contract. */
          const members = Object.freeze([Object.freeze({ id: 'call-0', name: 'read', input })]);
          assert.equal(capturePreparedMembership({ members, declaredNames: membershipNames(1) }), JSON.stringify(members));
        }
      });
    }),
    it({
      name: 'retains original empty prepared group and native array projection behavior',
      fn: async () => {
        assert.equal(capturePreparedMembership({ members: Object.freeze([]), declaredNames: [] }), '[]');
        /** Native prepared-array projection is not a second membership decoder in the original constructor. */
        const members = Object.freeze(Object.defineProperty([], 'toJSON', { value() { return { retained: true }; } }));
        assert.equal(capturePreparedMembership({ members, declaredNames: [] }), '{"retained":true}');
      }
    })
    //endregion
  ]
});
