/**
 Known divergences between deepmerge-ts and its documented semantics.

 Each test asserts that the divergence still reproduces, beside the documented
 outcome it should have, so the unit suite stays green while upstream is
 unfixed and turns red the moment upstream changes behaviour. When one fails
 after an upgrade: confirm the fix, delete the test, and re-include the
 excluded region in the generators named by its comment.

 Upstream reporting: one combined issue draft, held locally for the user
 (`doc/handover/deepmerge-ts-hardening.md`, Q3 and confirmation constraints).

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { Point, } from './arbitraries.ts';
import { target, } from './target.ts';

/**
 Build a record from entries with `defineProperty` semantics for readability.

 @param entries - Key and value pairs in insertion order.

 @returns Plain record holding every entry.

 @example
 ```ts
 plain([['a', 1,],]); // { a: 1 }
 ```
 */
function plain(entries: readonly (readonly [string, unknown,])[],): Record<string, unknown> {
  return Object.fromEntries(entries,);
}

await describe({
  name: 'deepmerge-ts known defects still reproduce',
  children: [
    it({
      name: 'shared subobject reachable from another input\'s ancestor is mistaken for a cycle',
      // Excluded region: generators never share a container between inputs (src/arbitraries.ts).
      // Cause: getCyclicReferenceDepth in src/utils.ts matches any input's ancestors via parents.includes.
      fn: () => {
        /**
         Subobject placed at two different depths across the inputs.
         */
        const shared = plain([['v', 1,], ['k2', plain([['w', 2,],],),],],);
        /**
         Merge result; documented semantics give `r.k.k2 === shared`.
         */
        const merged = target.deepmerge(plain([['k', shared,],],), plain([['k', plain([['k2', shared,],],),],],),);
        /**
         Node that should be `shared` but is the merged `k` record itself.
         */
        const nested = Reflect.get(Reflect.get(merged, 'k',) as object, 'k2',);
        expect(nested,).toBe(Reflect.get(merged, 'k',),);
        expect(() => JSON.stringify(merged,),).toThrow(TypeError,);
      },
    },),
    it({
      name: 'deepmergeInto seeds an absent key from its first value and merges later records into that copy',
      // Excluded region: deepmergeInto properties use objectLeaves: false (src/merge-model.property.unit.test.ts).
      // Cause: mergeRecordsInto seeds emptyLike(propValues[0]) in src/defaults/into.ts, and mergeUnknownsInto
      // types the merge by that seeded {} without checking the first value's own kind.
      fn: () => {
        /**
         Record that must win outright, by documented last-value semantics.
         */
        const last = Object.create(null,) as object;
        /**
         `deepmerge` result: the last value itself, as documented.
         */
        const merged = target.deepmerge(plain([['a', new Point(0,),],],), plain([['a', last,],],),);
        expect(Reflect.get(merged, 'a',),).toBe(last,);

        /**
         `deepmergeInto` target lacking the key.
         */
        const intoTarget = {};
        target.deepmergeInto(intoTarget, plain([['a', new Point(0,),],],), plain([['a', last,],],),);
        /**
         Value `deepmergeInto` stored instead of `last`.
         */
        const stored = Reflect.get(intoTarget, 'a',) as object;
        expect(stored,).not.toBe(last,);
        expect(Object.getPrototypeOf(stored,),).toBe(Object.prototype,);
        expect(Reflect.ownKeys(stored,),).toEqual(['x',],);
      },
    },),
    it({
      name: 'array holes are dropped instead of concatenated (upstream intent question)',
      // Excluded region: generators build dense arrays only (src/arbitraries.ts).
      // Cause: mergeArrays uses Array.prototype.flat in src/defaults/general.ts, which skips holes.
      fn: () => {
        /**
         Array with a hole at index 0.
         */
        // oxlint-disable-next-line no-sparse-arrays -- The hole is the input under test.
        const holed = [, 1,];
        expect(holed.concat([2,],),).toHaveLength(3,);
        expect(target.deepmerge(holed, [2,],),).toEqual([1, 2,],);
      },
    },),
    it({
      name: 'a cycle deeper than one level in a single input is passed through, not remapped (upstream intent question)',
      // Excluded region: the cycle property merges inputs cyclic along the same chain only
      // (src/merge-invariant.property.unit.test.ts).
      // Observation: a direct self-reference is remapped onto the result, a two-level cycle keeps
      // pointing at the input, so the merged graph mixes result and input nodes.
      fn: () => {
        /**
         Input whose `self.self` returns to it.
         */
        const looped: Record<string, unknown> = { extra: 1, };
        looped['self'] = { self: looped, };
        /**
         Merge with a record contributing a key the input lacks.
         */
        const merged = target.deepmerge(looped, { added: true, },);
        /**
         Node two `self` hops from the result.
         */
        const twoHops = Reflect.get(Reflect.get(merged, 'self',) as object, 'self',);
        expect(twoHops,).toBe(looped,);
        expect(twoHops,).not.toBe(merged,);

        /**
         Direct self-reference, which is remapped onto the result.
         */
        const direct: Record<string, unknown> = { extra: 1, };
        direct['self'] = direct;
        /**
         Merge of the direct self-reference with the same extra record.
         */
        const mergedDirect = target.deepmerge(direct, { added: true, },);
        expect(Reflect.get(mergedDirect, 'self',),).toBe(mergedDirect,);
      },
    },),
  ],
},);
