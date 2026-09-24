/**
 Example tests for `./alias-rewire.ts`: edge snapshots detect writes by
 identity, and `storedByReference` finds exactly the input nodes a result
 holds directly. The campaign counterexample (seed 1395258848) doubles as the
 positive control for the narrowed property in
 `./alias-graph.property.unit.test.ts`.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  reachableContainers,
  rewiredNodes,
  snapshotEdges,
  storedByReference,
} from './alias-rewire.ts';
import { target, } from './target.ts';

/**
 Four-node cyclic graph from the campaign counterexample.

 @returns Fresh nodes of one graph.

 @example
 ```ts
 const { n1, } = counterexampleGraph();
 ```
 */
function counterexampleGraph(): Readonly<Record<'n0' | 'n1' | 'n2' | 'n4', Record<string, unknown>>> {
  /**
   Node reached from `n1` through `c`.
   */
  const n0: Record<string, unknown> = {};
  /**
   Source root.
   */
  const n1: Record<string, unknown> = {};
  /**
   Target root shape.
   */
  const n2: Record<string, unknown> = {};
  /**
   Node shared by `n1.b` and `n2.c`.
   */
  const n4: Record<string, unknown> = {};
  n0.a = n2;
  n1.c = n0;
  n1.b = n4;
  n2.c = n4;
  n2.b = n1;
  n4.b = n0;
  return { n0, n1, n2, n4, };
}

await describe({
  name: 'alias rewire helpers',
  children: [
    it({
      name: 'reachableContainers visits each container of a cyclic graph once',
      fn: async () => {
        /**
         Graph under test.
         */
        const graph = counterexampleGraph();
        expect(reachableContainers([graph.n1, 1, graph.n1,],).size,).toBe(4,);
      },
    },),
    it({
      name: 'rewiredNodes reports added keys and same-key identity changes only',
      fn: async () => {
        /**
         Node that gains a key.
         */
        const grown: Record<string, unknown> = { a: 1, };
        /**
         Node whose child is replaced by an equal-looking object.
         */
        const replaced: Record<string, unknown> = { a: {}, };
        /**
         Node left alone.
         */
        const untouched: Record<string, unknown> = { a: 1, };
        /**
         Edges before the writes.
         */
        const edges = snapshotEdges(new Set([grown, replaced, untouched,],),);
        grown.b = 2;
        replaced.a = {};
        expect(rewiredNodes(edges,),).toEqual([grown, replaced,],);
      },
    },),
    it({
      name: 'the campaign counterexample rewires exactly the source node the target stores',
      fn: async () => {
        /**
         Graph whose `n2` is the target root.
         */
        const into = counterexampleGraph();
        /**
         Graph whose `n1` is the source root.
         */
        const source = counterexampleGraph();
        /**
         Source edges before the merge.
         */
        const edges = snapshotEdges(reachableContainers([source.n1,],),);
        target.deepmergeInto(into.n2, source.n1,);
        /**
         Source nodes the target holds directly.
         */
        const stored = storedByReference({ edges, root: into.n2, },);
        expect([...stored,],).toEqual([source.n2,],);
        expect(rewiredNodes(edges,),).toEqual([source.n2,],);
      },
    },),
  ],
},);
