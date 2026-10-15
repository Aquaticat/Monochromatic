/**
 Original native combinators retain complete declarations and privately owned patterns. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { patterns } from './native-profile-call-fixture.ts';
import { inspectSuccessors, producer } from './native-profile-successors-fixture.ts';

await describe({ name: 'original native successor declarations', children: [
  //region Original combinators preserve order, aliases, source, and private pattern ownership.
  ...['all', 'allSettled'].map(function combinator(kind) {
    return it({ name: `retains ${kind} members and source spans`, fn: async function completeDeclaration() {
      const source = `Promise.${kind}([tools.tool({ result }), tools.tool({ nested: [result, "literal"] })])`;
      const result = inspectSuccessors({ source });
      assert.equal(result.bindingName, 'result');
      assert.equal(result.profile, 'awaited-string-result-then-literal-parallel');
      assert.equal(result.sites.length, 3);
      const [first, second] = result.groups;
      assert.deepEqual(first, { ordinal: 0, kind: 'awaited-producer', members: [producer] });
      assert.ok(second);
      assert.equal(second.ordinal, 1);
      assert.equal(second.kind, kind);
      assert.equal(result.sites[0], producer);
      assert.equal(first?.members[0], producer);
      assert.equal(second.members.length, 2);
      for (const [ordinal, site] of second.members.entries()) {
        assert.equal(site, result.sites[ordinal + 1]);
        assert.equal(site.group, 1);
        assert.equal(site.ordinal, ordinal);
        assert.equal(site.name, 'tool');
        assert.equal(site.alias, `__owned_flow_1_${ordinal}`);
        assert.equal(site.callee.text, 'tools.tool');
        assert.equal(source.slice(site.callee.start, site.callee.end), 'tools.tool');
        assert.ok(Object.isFrozen(site));
      }
      const [one, two] = second.members;
      assert.ok(one && two);
      assert.deepEqual(patterns.materializePattern({ pattern: one.pattern, result: 'actual result' }), { result: 'actual result' });
      assert.deepEqual(patterns.materializePattern({ pattern: two.pattern, result: 'actual result' }), { nested: ['actual result', 'literal'] });
      for (const value of [result, result.groups, first, second, first?.members, second.members, result.sites]) {
        assert.equal(Object.isFrozen(value), false);
      }
    } });
  }),
  it({ name: 'accepts the inclusive complete collection limit', fn: async function inclusiveLimit() {
    const source = `Promise.all([${Array.from({ length: 32 }, function call() { return 'tools.tool({ result })'; }).join(',')}])`;
    assert.doesNotThrow(function acceptedLimit() {
      const result = inspectSuccessors({ source });
      assert.equal(result.sites.length, 33);
      assert.equal(result.groups[1]?.members.length, 32);
      assert.equal(result.sites.at(-1)?.ordinal, 31);
    });
  } }),
  it({ name: 'retains escaped original callee text and parser wrapper offsets', fn: async function escapedSource() {
    const prefix = '/* wrapper */';
    const source = String.raw`Promise.all([tools.\u0074ool({ result })])`;
    const result = inspectSuccessors({ source: prefix + source, input: { source, prefix } });
    const site = result.sites.at(1);
    assert.ok(site);
    assert.equal(site.name, 'tool');
    assert.equal(site.callee.text, String.raw`tools.\u0074ool`);
    assert.equal(source.slice(site.callee.start, site.callee.end), site.callee.text);
  } }),
  //endregion
] });
