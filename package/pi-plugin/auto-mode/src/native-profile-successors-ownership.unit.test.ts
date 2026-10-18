/**
 Original mapping preserves borrowed identities, getter order, and opaque failures. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { inspectSuccessors, producer, returnedGroup } from './native-profile-successors-fixture.ts';

await describe({ name: 'original successor ownership', children: [
  //region Borrowed inspection retains original callback inputs and exact results.
  it({ name: 'forwards original syntax and context in member order without freezing', fn: async function borrowedIdentity() {
    const calls = [{ marker: 'first' }, { marker: 'second' }];
    const allowed = new Set(['borrowed']);
    const observed: Readonly<Record<string, unknown>>[] = [];
    const replacements = [{ ...producer, name: 'one' }, { ...producer, name: 'two' }];
    const result = inspectSuccessors({ input: {
      returned: returnedGroup({ arguments: [{ type: 'ArrayExpression', elements: calls }] }),
      allowed, source: 'original source', prefix: 'original prefix',
      inspectCall(input: Readonly<Record<string, unknown>>) {
        observed.push(input);
        return replacements.at(observed.length - 1);
      },
    } });
    assert.deepEqual(observed, calls.map(function expected(call, ordinal) {
      return { call, group: 1, ordinal, bindingName: 'result', allowed, source: 'original source', prefix: 'original prefix' };
    }));
    assert.equal(observed[0]?.call, calls[0]);
    assert.equal(observed[1]?.call, calls[1]);
    assert.equal(observed[0]?.allowed, allowed);
    assert.equal(result.sites[1], replacements[0]);
    assert.equal(result.sites[2], replacements[1]);
    assert.equal(result.groups[1]?.members[0], replacements[0]);
    for (const value of [...calls, ...replacements, ...observed, allowed]) assert.equal(Object.isFrozen(value), false);
  } }),
  it({ name: 'rereads original binding per mapped member and during final publication', fn: async function bindingReads() {
    const names: string[] = [];
    const seen: unknown[] = [];
    const result = inspectSuccessors({ source: 'Promise.all([tools.tool({}), tools.tool({})])', input: {
      declaration: { get id() { 
        names.push('id');
      return { get name() { 
        names.push('name');
      return `binding${names.length}`; 
      } }; 
      } },
      inspectCall(input: Readonly<Record<string, unknown>>) { 
        seen.push(input.bindingName);
      return producer; 
      },
    } });
    assert.deepEqual(names, ['id', 'name', 'id', 'name', 'id', 'name']);
    assert.deepEqual(seen, ['binding2', 'binding4']);
    assert.equal(result.bindingName, 'binding6');
  } }),
  it({ name: 'preserves sparse synthetic mapping and spread publication', fn: async function sparseMapping() {
    const elements: object[] = [];
    elements.length = 2;
    elements[1] = { marker: 'present' };
    const seen: unknown[] = [];
    const result = inspectSuccessors({ input: {
      returned: returnedGroup({ arguments: [{ type: 'ArrayExpression', elements }] }),
      inspectCall(input: Readonly<Record<string, unknown>>) { 
        seen.push(input.ordinal);
      return producer; 
      },
    } });
    assert.deepEqual(seen, [1]);
    const members = result.groups[1]?.members;
    assert.ok(members);
    assert.equal(members.length, 2);
    assert.equal(Object.hasOwn(members, 0), false);
    assert.equal(members[1], producer);
    assert.deepEqual(result.sites, [producer, undefined, producer]);
    assert.equal(Object.hasOwn(result.sites, 1), true);
    assert.equal(Object.isFrozen(elements), false);
  } }),
  //endregion
  //region Original repeated member reads and failure boundaries remain observable.
  it({ name: 'repeats static member reads for allSettled and publishes the later method name', fn: async function memberReads() {
    const reads: string[] = [];
    const callee = {
      get type() { 
        reads.push('type');
      return 'MemberExpression'; 
      },
      get computed() { 
        reads.push('computed');
      return false; 
      },
      get optional() { 
        reads.push('optional');
      return false; 
      },
      get object() { 
        reads.push('object');
      return { type: 'Identifier', name: 'Promise' }; 
      },
      get property() { 
        reads.push('property');
      return { type: 'Identifier', get name() { 
        reads.push('name');
      return 'allSettled'; 
      } }; 
      },
    };
    const result = inspectSuccessors({ input: { returned: returnedGroup({ callee }), inspectCall() { 
      return producer; 
    } } });
    const member = ['type', 'computed', 'optional', 'object', 'object', 'property', 'property', 'name'];
    assert.deepEqual(reads, [...member, ...member, 'property', 'name']);
    assert.equal(result.groups[1]?.kind, 'allSettled');
    const readsOfName: boolean[] = [];
    const changing = inspectSuccessors({ input: { returned: returnedGroup({ callee: {
      type: 'MemberExpression', object: { type: 'Identifier', name: 'Promise' }, property: { type: 'Identifier', get name() {
        readsOfName.push(true);
        return readsOfName.length === 1 ? 'all' : 'published method';
      } },
    } }), inspectCall() { 
      return producer; 
    } } });
    assert.equal(changing.groups[1]?.kind, 'published method');
  } }),
  it({ name: 'retains a completed member before later inspection fails and stops mapping', fn: async function partialInspection() {
    const seen: unknown[] = [];
    const failure: unknown = Object.freeze({ reason: 'original call failure' });
    assert.throws(function laterFailure() {
      inspectSuccessors({ source: 'Promise.all([tools.tool({}), tools.tool({}), tools.tool({})])', input: {
        inspectCall(input: Readonly<Record<string, unknown>>) {
          seen.push(input.ordinal);
          if (input.ordinal === 1) throw failure;
          return producer;
        },
      } });
    }, function sameFailure(error: unknown) { 
      assert.equal(error, failure);
    return true; 
    });
    assert.deepEqual(seen, [0, 1]);
  } }),
  it({ name: 'propagates original syntax, binding, and callback failure identities', fn: async function opaqueFailures() {
    const failure: unknown = Object.freeze({ reason: 'original boundary failure' });
    for (const input of [
      { returned: { get argument() { 
        throw failure; 
      } } },
      { returned: returnedGroup({ callee: { get type() { 
        throw failure; 
      } } }) },
      { declaration: { get id() { 
        throw failure; 
      } } },
      { inspectCall() { 
        throw failure; 
      } },
    ]) {
      assert.throws(function originalFailure() { 
        inspectSuccessors({ input }); 
      }, function sameFailure(error: unknown) {
        assert.equal(error, failure);
        return true;
      });
    }
  } }),
  //endregion
] });
