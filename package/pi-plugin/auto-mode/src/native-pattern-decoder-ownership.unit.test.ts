/**
 Original owner publication, getter order, and opaque failures remain observable. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import type { Pattern } from './native-pattern-decoder-fixture.ts';
import { decode, objectNode, parseArgument } from './native-pattern-decoder-fixture.ts';
import { patterns } from './native-profile-call-fixture.ts';

await describe({ name: 'original pattern ownership', children: [
  //region Original owner sees children before parents and supplies each returned value.
  it({ name: 'publishes children before frozen collection envelopes without prefreezing owned values', fn: async function publication() {
    const seen: Pattern[] = [];
    const result = decode({ node: parseArgument('{ key: [1, result] }'), bindingName: 'result',
      owned(value: Pattern) {
        assert.equal(Object.isFrozen(value), false);
        if (value.kind === 'array') assert.ok(Object.isFrozen(value.items));
        if (value.kind === 'object') {
          assert.ok(Object.isFrozen(value.entries));
          assert.ok(value.entries.every(function frozen(entry) { 
            return Object.isFrozen(entry); 
          }));
        }
        seen.push(value);
        return Object.freeze(value);
      },
    });
    assert.deepEqual(seen.map(function kind(pattern) { 
      return pattern.kind; 
    }), ['literal', 'result', 'array', 'object']);
    assert.equal(result, seen[3]);
    assert.ok(result.kind === 'object');
    assert.equal(result.entries[0]?.pattern, seen[2]);
    const array = seen[2];
    assert.ok(array?.kind === 'array');
    assert.equal(array.items[0], seen[0]);
    assert.equal(array.items[1], seen[1]);
    assert.equal(result.entries[0]?.key, 'key');
  } }),
  it({ name: 'returns every borrowed owner substitution by identity', fn: async function returnedOwner() {
    const replacement = { kind: 'literal', value: 'owner replacement' } as const;
    for (const source of ['1', 'result', '[]', '{}']) {
      assert.equal(decode({ node: parseArgument(source), bindingName: 'result', owned() { 
        return replacement; 
      } }), replacement);
    }
    const result = decode({ node: parseArgument('[1]'), owned(value: Pattern) {
      if (value.kind === 'literal') return replacement;
      return value;
    } });
    assert.ok(result.kind === 'array');
    assert.equal(result.items[0], replacement);
  } }),
  it({ name: 'keeps borrowed-owner output outside original private ownership', fn: async function privateOwnership() {
    const pattern = decode({ node: parseArgument('1') });
    assert.throws(function forgedOwnership() { 
      patterns.materializePattern({ pattern }); 
    }, {
      constructor: patterns.ResultProgramProfileError,
      message: 'Result-derived program is outside the inspected profile: pattern was not created by this source decoder',
    });
  } }),
  it({ name: 'retains already published children when a later child fails and never publishes its parent', fn: async function partialPublication() {
    const seen: Pattern[] = [];
    assert.throws(function laterChildFailure() {
      decode({ node: parseArgument('[1, other]'), owned(value: Pattern) { 
        seen.push(value);
      return value; 
      } });
    }, { constructor: patterns.ResultProgramProfileError });
    assert.deepEqual(seen, [{ kind: 'literal', value: 1 }]);
  } }),
  //endregion
  //region Getter order preserves the original syntax boundary and failure identity.
  it({ name: 'reads literal value before metadata and short circuits rejected regex metadata', fn: async function literalReads() {
    const reads: string[] = [];
    const node = { get type() { 
      reads.push('type');
    return 'Literal'; 
    }, get value() { 
      reads.push('value');
    return 1; 
    },
      get regex() { 
        reads.push('regex');
      return undefined; 
      }, get bigint() { 
        reads.push('bigint');
      return undefined; 
      } };
    assert.deepEqual(decode({ node }), { kind: 'literal', value: 1 });
    assert.deepEqual(reads, ['type', 'type', 'value', 'regex', 'bigint']);
    const rejectedReads: string[] = [];
    assert.throws(function rejectedRegex() {
      decode({ node: { type: 'Literal', get value() { 
        rejectedReads.push('value');
      return 1; 
      },
        get regex() { 
          rejectedReads.push('regex');
        return {}; 
        }, get bigint() { 
          rejectedReads.push('bigint');
        return '1'; 
        } } });
    }, { constructor: patterns.ResultProgramProfileError });
    assert.deepEqual(rejectedReads, ['value', 'regex']);
  } }),
  it({ name: 'retains repeated unary argument and property key reads', fn: async function repeatedReads() {
    const reads: string[] = [];
    const argument = { type: 'Literal', get value() { 
      reads.push('value');
    return reads.filter(function values(item) { 
      return item === 'value'; 
    }).length; 
    } };
    assert.deepEqual(decode({ node: { type: 'UnaryExpression', operator: '-', get argument() { 
      reads.push('argument');
    return argument; 
    } } }), { kind: 'literal', value: -2 });
    assert.deepEqual(reads, ['argument', 'argument', 'value', 'argument', 'value']);
    const keyReads: string[] = [];
    const key = { get type() { 
      keyReads.push('type');
    return 'Literal'; 
    }, get value() { 
      keyReads.push('value');
    return 'x'; 
    } };
    const node = { type: 'ObjectExpression', properties: [{ type: 'Property', computed: false, method: false, kind: 'init', shorthand: false,
      get key() { 
        keyReads.push('key');
      return key; 
      }, value: { type: 'Literal', value: true } }] };
    assert.deepEqual(decode({ node }), { kind: 'object', entries: [{ key: 'x', pattern: { kind: 'literal', value: true } }] });
    assert.deepEqual(keyReads, ['key', 'type', 'key', 'type', 'key', 'value', 'key', 'value']);
  } }),
  it({ name: 'propagates opaque node, key, and ownership failures unchanged', fn: async function opaqueFailures() {
    const failure: unknown = Object.freeze({ reason: 'original decoder failure' });
    for (const input of [
      { node: { get type() { 
        throw failure; 
      } } },
      { node: objectNode({ key: { get type() { 
        throw failure; 
      } } }) },
      { node: parseArgument('[1]'), owned() { 
        throw failure; 
      } },
    ]) {
      assert.throws(function originalFailure() { 
        decode(input); 
      }, function sameFailure(error: unknown) { 
        assert.equal(error, failure);
      return true; 
      });
    }
  } }),
  //endregion
] });
