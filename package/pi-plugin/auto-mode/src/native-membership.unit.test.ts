/**
 Original response snapshots preserve complete membership, original serialization order, and caller independence. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { captureMembership, membershipNames } from './native-membership-fixture.ts';

await describe({
  name: 'original native response membership',
  children: [
    //region Frozen declarations preserve complete response order and exact native JSON.
    it({
      name: 'copies complete ordered identities and preserves escaped native JSON without retaining caller mutation',
      fn: async () => {
        /** Quoted and escaped identifiers remain ordinary JSON data at the consumer boundary. */
        const calls = [
          { type: 'toolCall', id: 'first"\n\\', name: 'read', arguments: { path: '../a"\n.txt' } },
          { type: 'text', text: 'original response' },
          { type: 'toolCall', id: 'second', name: 'write', arguments: { content: '</script>\n${literal}' } }
        ];
        /** Snapshot is produced by the built original response owner. */
        const snapshot = captureMembership({ content: calls });
        assert.equal(snapshot.parentJSON, JSON.stringify(calls));
        assert.deepEqual(snapshot.declaredNames, [{ id: 'first"\n\\', name: 'read' }, { id: 'second', name: 'write' }]);
        assert.ok(Object.isFrozen(snapshot.declaredNames));
        assert.ok(snapshot.declaredNames.every(function frozenIdentity(identity) { return Object.isFrozen(identity); }));
        assert.deepEqual(Reflect.ownKeys(snapshot.declaredNames[0] ?? {}), ['id', 'name']);
        calls.push({ type: 'toolCall', id: 'late', name: 'read', arguments: { path: 'late' } });
        assert.equal(snapshot.declaredNames.length, 2);
        assert.equal(snapshot.parentJSON.includes('late'), false);
      }
    }),
    it({
      name: 'validates all original arguments before rereading response content for serialization',
      fn: async () => {
        /** Callback sequence exposes repeated original serialization without replacing the serializer. */
        const events: string[] = [];
        /** Original calls deliberately retain serializer callbacks until the native JSON boundary. */
        const content = ['a', 'b'].map(function nativeCall(id) {
          return { type: 'toolCall', id, name: 'read', arguments: {
            toJSON() { events.push(`input:${id}`); return { path: `${id}.txt` }; }
          } };
        });
        /** The response getter must still be read once for validation and once for serialization. */
        const response = { get content() { events.push('content'); return content; } };
        /** Built snapshot must preserve every original callback and its order. */
        const snapshot = captureMembership(response);
        assert.deepEqual(events, ['content', 'input:a', 'input:b', 'content', 'input:a', 'input:b']);
        assert.equal(snapshot.declaredNames.length, 2);
      }
    }),
    it({
      name: 'accepts the complete maximum group and ignores non-tool JSON parts after serialization',
      fn: async () => {
        /** Independently generated maximum membership does not reuse production limit constants. */
        const names = membershipNames(64);
        /** Native response retains one original argument object per declared call. */
        const calls = names.map(function nativeCall(identity) { return { type: 'toolCall', ...identity, arguments: {} }; });
        assert.deepEqual(captureMembership({ content: calls }).declaredNames, names);
        /** JSON projection may contain scalar or null non-tool parts that do not declare membership. */
        const content = Object.defineProperty([...calls], 'toJSON', {
          value() { return [null, false, 1, 'text', { type: 'text' }, ...calls]; }
        });
        assert.deepEqual(captureMembership({ content }).declaredNames, names);
      }
    }),
    //endregion
    //region Missing or ambiguous native identities cannot publish a declared group.
    ...[
      [],
      [{ type: 'text', text: 'no native calls' }],
      [{ type: 'toolCall', id: '', name: 'read', arguments: {} }],
      [{ type: 'toolCall', id: 1, name: 'read', arguments: {} }],
      [{ type: 'toolCall', id: 'a', name: '', arguments: {} }],
      [{ type: 'toolCall', id: 'a', arguments: {} }],
      [{ type: 'toolCall', name: 'read', arguments: {} }],
      [{ type: 'toolCall', id: 'a', name: 'read', arguments: {} }, { type: 'toolCall', id: 'a', name: 'write', arguments: {} }],
      membershipNames(65).map(function oversizedCall(identity) { return { type: 'toolCall', ...identity, arguments: {} }; })
    ].map(function invalidMembership(content, ordinal) {
      return it({
        name: `rejects incomplete or ambiguous native group case ${String(ordinal)}`,
        fn: async () => {
          assert.throws(() => captureMembership({ content }), {
            name: 'JudgmentConstructionError', message: 'Enclosing judgment requires complete unique native tool membership'
          });
        }
      });
    })
    //endregion
  ]
});
