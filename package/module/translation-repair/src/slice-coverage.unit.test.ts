/**
 * Tests for the block-coverage check on carved slices.
 *
 * THE FAILURE IT EXISTS FOR is silent: a block that reached no slice leaves the
 * document, and no range disagrees with itself, so `assertSpanContiguity` sees
 * nothing wrong. Every case here is therefore built by carving blocks AWAY from
 * a pair rather than by malforming one, which is what production did.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  assertSliceCoverage,
  SliceCoverageError,
} from '../dist/final/node/index.mjs';

/**
 * One block of a document, as the parser emits them.
 */
type Block = {
  readonly id: string;
  readonly zone: 'body';
  readonly kind: 'paragraph';
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly contentHash: string;
};

/**
 * Builds a document node standing in for one block.
 *
 * @param id - block id, unique within its side
 *
 * @param at - start offset, with the node one character long
 *
 * @returns Node shaped as the parser emits them
 *
 * @example
 * ```ts
 * const node = blockNode({ id: 'block/0', at: 0, },);
 * ```
 */
function blockNode(
  {
    id,
    at,
  }: {
    readonly id: string;
    readonly at: number;
  },
): Block {
  return {
    id,
    zone: 'body',
    kind: 'paragraph',
    text: 'The cat naps.',
    startOffset: at,
    endOffset: at + 1,
    contentHash: id,
  };
}

/**
 * One side of a chunk, as slicing produces it.
 */
type Side = {
  readonly chunkIndex: number;
  readonly nodes: readonly Block[];
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
};

/**
 * Builds one side of a chunk from a run of blocks.
 *
 * @param nodes - blocks this side carries
 *
 * @returns Chunk side shaped as slicing produces it
 *
 * @example
 * ```ts
 * const side = chunkSide({ nodes: [FIRST_ORIGINAL,], },);
 * ```
 */
function chunkSide({ nodes, }: { readonly nodes: readonly Block[]; },): Side {
  return {
    chunkIndex: 0,
    nodes,
    startOffset: nodes.at(0,)?.startOffset ?? 0,
    endOffset: nodes.at(-1,)?.endOffset ?? 0,
    text: 'The cat naps.',
  };
}

/**
 * First original of the pair.
 */
const FIRST_ORIGINAL = blockNode({
  id: 'block/0',
  at: 0,
},);

/**
 * Second original of the pair.
 */
const SECOND_ORIGINAL = blockNode({
  id: 'block/1',
  at: 2,
},);

/**
 * Third original, the one production lost.
 */
const THIRD_ORIGINAL = blockNode({
  id: 'block/2',
  at: 4,
},);

/**
 * First rendering, which the first two originals share.
 */
const FIRST_RENDERING = blockNode({
  id: 'block/0',
  at: 0,
},);

/**
 * Second rendering.
 */
const SECOND_RENDERING = blockNode({
  id: 'block/1',
  at: 2,
},);

/**
 * The pair every carving here was carved from.
 */
const PAIR = {
  source: chunkSide({
    nodes: [
      FIRST_ORIGINAL,
      SECOND_ORIGINAL,
      THIRD_ORIGINAL,
    ],
  },),
  target: chunkSide({
    nodes: [
      FIRST_RENDERING,
      SECOND_RENDERING,
    ],
  },),
};

await describe({
  name: assertSliceCoverage.name,
  children: [
    it({
      name: 'ACCEPTS a carving that places every block exactly once',
      fn: async () => {
        assertSliceCoverage({
          pair: PAIR,
          carved: [
            {
              source: chunkSide({
                nodes: [
                  FIRST_ORIGINAL,
                  SECOND_ORIGINAL,
                ],
              },),
              target: chunkSide({ nodes: [FIRST_RENDERING,], },),
            },
            {
              source: chunkSide({ nodes: [THIRD_ORIGINAL,], },),
              target: chunkSide({ nodes: [SECOND_RENDERING,], },),
            },
          ],
        },);
      },
    },),
    it({
      name: 'REFUSES a carving that leaves an original in no slice at all',
      fn: async () => {
        // THE PRODUCTION FAILURE, reduced: the last original is simply absent
        // from every slice. Nothing else about the carving is wrong, which is
        // why no other check in the pipeline can see it.
        expect(function losesTheLastBlock() {
          assertSliceCoverage({
            pair: PAIR,
            carved: [
              {
                source: chunkSide({
                  nodes: [
                    FIRST_ORIGINAL,
                    SECOND_ORIGINAL,
                  ],
                },),
                target: chunkSide({
                  nodes: [
                    FIRST_RENDERING,
                    SECOND_RENDERING,
                  ],
                },),
              },
            ],
          },);
        },).toThrow(SliceCoverageError,);
      },
    },),
    it({
      name: 'REFUSES a carving that places one block into two slices',
      fn: async () => {
        // A REPEAT IS NOT MERELY UNTIDY: the grouper measures characters per
        // step, so a block counted twice inflates a run past its budget and
        // cuts the document somewhere it should not.
        expect(function repeatsABlock() {
          assertSliceCoverage({
            pair: PAIR,
            carved: [
              {
                source: chunkSide({
                  nodes: [
                    FIRST_ORIGINAL,
                    SECOND_ORIGINAL,
                  ],
                },),
                target: chunkSide({ nodes: [FIRST_RENDERING,], },),
              },
              {
                source: chunkSide({
                  nodes: [
                    SECOND_ORIGINAL,
                    THIRD_ORIGINAL,
                  ],
                },),
                target: chunkSide({ nodes: [SECOND_RENDERING,], },),
              },
            ],
          },);
        },).toThrow(SliceCoverageError,);
      },
    },),
    it({
      name: 'REFUSES a carving that reorders the blocks it places',
      fn: async () => {
        // OUT OF ORDER means one slice gathers text from two places in the
        // document, which reads as a coherent passage and is not one.
        expect(function reordersBlocks() {
          assertSliceCoverage({
            pair: PAIR,
            carved: [
              {
                source: chunkSide({
                  nodes: [
                    THIRD_ORIGINAL,
                    FIRST_ORIGINAL,
                  ],
                },),
                target: chunkSide({ nodes: [FIRST_RENDERING,], },),
              },
              {
                source: chunkSide({ nodes: [SECOND_ORIGINAL,], },),
                target: chunkSide({ nodes: [SECOND_RENDERING,], },),
              },
            ],
          },);
        },).toThrow(SliceCoverageError,);
      },
    },),
    it({
      name: 'REFUSES a rendering dropped while the originals are whole',
      fn: async () => {
        // CHECKED PER SIDE. A carving can keep every original and still lose a
        // rendering, and losing one deletes shipped English just as surely.
        expect(function losesARendering() {
          assertSliceCoverage({
            pair: PAIR,
            carved: [
              {
                source: chunkSide({
                  nodes: [
                    FIRST_ORIGINAL,
                    SECOND_ORIGINAL,
                    THIRD_ORIGINAL,
                  ],
                },),
                target: chunkSide({ nodes: [FIRST_RENDERING,], },),
              },
            ],
          },);
        },).toThrow(SliceCoverageError,);
      },
    },),
  ],
},);
