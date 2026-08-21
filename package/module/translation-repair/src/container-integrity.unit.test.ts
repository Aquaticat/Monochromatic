/**
 * Tests for the check that no slice range breaks a container it does not own
 * whole.
 *
 * The failure this exists for is invisible to every other invariant here.
 * A dissolved container leaves its opening and closing tags in no block, so a
 * range holding one of them and not the other satisfies every node-level rule
 * while assembly deletes that tag and keeps its partner.
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
  assertContainerIntegrity,
  type ChunkPair,
  ContainerIntegrityError,
  type ContainerSpan,
  makeInsertionChunk,
  parseDocument,
} from '../dist/final/node/index.mjs';

/**
 * Translation packaging two of its four blocks inside a disclosure element, so
 * the element's tags land between blocks rather than in one.
 */
const TARGET_TEXT = `The cat sleeps on the windowsill.

<details>

She watches the birds outside.

Later she eats.

</details>

She purrs at nothing in particular.
`;

/**
 * Blocks of that translation, with the container already dissolved.
 */
const TARGET_NODES = parseDocument({ text: TARGET_TEXT, },).nodes;

/**
 * Container spans the parse reported, which is the whole point of the fixture.
 */
const TARGET_CONTAINERS = parseDocument({ text: TARGET_TEXT, },).containers;

/**
 * Builds one pair whose target side covers the given range.
 *
 * @param startOffset - absolute start of range assembly would replace
 *
 * @param endOffset - absolute exclusive end
 *
 * @returns Pair carrying that span
 *
 * @example
 * ```ts
 * const pair = rangeOf({ startOffset: 0, endOffset: 20, },);
 * ```
 */
function rangeOf(
  {
    startOffset,
    endOffset,
  }: {
    readonly startOffset: number;
    readonly endOffset: number;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '猫猫在窗台上睡觉。',
    },
    target: {
      chunkIndex: 0,
      nodes: TARGET_NODES.filter(function inRange(node,): boolean {
        return (node.startOffset >= startOffset)
          && (node.endOffset <= endOffset);
      },),
      startOffset,
      endOffset,
      text: TARGET_TEXT.slice(
        startOffset,
        endOffset,
      ),
    },
  };
}

/**
 * Single container of the fixture, which every case is stated against.
 *
 * @returns Its two tag spans
 *
 * @throws {@link Error} when the fixture parsed no container, which would make
 * every case below pass for the wrong reason
 *
 * @example
 * ```ts
 * const container = onlyContainer();
 * ```
 */
function onlyContainer(): ContainerSpan {
  const [container,] = TARGET_CONTAINERS;
  if ((container === undefined) || (TARGET_CONTAINERS.length !== 1))
    throw new Error(`fixture reported ${String(TARGET_CONTAINERS.length,)} containers, expected one`,);
  return container;
}

await describe({
  name: assertContainerIntegrity.name,
  children: [
    it({
      name: 'REFUSES a range holding the opening tag and stopping before the closing one, which is '
        + 'the shape that deleted a will: assembly replaces the range, so the opener goes and the '
        + 'closer stays behind with nothing to close',
      fn: async () => {
        /** Container whose halves the range will straddle. */
        const container = onlyContainer();
        expect(function checkOpenerOnly(): void {
          assertContainerIntegrity({
            slices: [
              rangeOf({
                startOffset: 0,
                endOffset: container.closerStartOffset,
              },),
            ],
            containers: TARGET_CONTAINERS,
          },);
        },).toThrow(ContainerIntegrityError,);
      },
    },),
    it({
      name: 'REFUSES the mirror, a range holding the closing tag without the opening one, since the '
        + 'element is destroyed either way and two corpus entries fail in this direction',
      fn: async () => {
        /** Container whose halves the range will straddle from the other side. */
        const container = onlyContainer();
        expect(function checkCloserOnly(): void {
          assertContainerIntegrity({
            slices: [
              rangeOf({
                startOffset: container.openerEndOffset,
                endOffset: TARGET_TEXT.length,
              },),
            ],
            containers: TARGET_CONTAINERS,
          },);
        },).toThrow(ContainerIntegrityError,);
      },
    },),
    it({
      name: 'ACCEPTS a range holding BOTH tags, which is the ordinary healthy case and the majority '
        + 'of pages using containers at all: the slice text carries them, so a candidate dropping '
        + 'them is refused later by the page grammar rather than here',
      fn: async () => {
        expect(function checkWholeContainer(): void {
          assertContainerIntegrity({
            slices: [
              rangeOf({
                startOffset: 0,
                endOffset: TARGET_TEXT.length,
              },),
            ],
            containers: TARGET_CONTAINERS,
          },);
        },).not.toThrow();
      },
    },),
    it({
      name: 'ACCEPTS a range holding NEITHER tag, so a slice landing wholly outside a container is '
        + 'left alone rather than refused for being near one',
      fn: async () => {
        /** Container the range will stay clear of. */
        const container = onlyContainer();
        expect(function checkOutsideContainer(): void {
          assertContainerIntegrity({
            slices: [
              rangeOf({
                startOffset: 0,
                endOffset: container.openerStartOffset,
              },),
            ],
            containers: TARGET_CONTAINERS,
          },);
        },).not.toThrow();
      },
    },),
    it({
      name: 'REFUSES a range ending PART WAY THROUGH a tag, which neither holds it nor leaves it '
        + 'alone: assembly would write over half of it and leave the rest',
      fn: async () => {
        /** Container whose opening tag the range will cut. */
        const container = onlyContainer();
        expect(function checkHalfTag(): void {
          assertContainerIntegrity({
            slices: [
              rangeOf({
                startOffset: 0,
                endOffset: container.openerStartOffset + 2,
              },),
            ],
            containers: TARGET_CONTAINERS,
          },);
        },).toThrow(ContainerIntegrityError,);
      },
    },),
    it({
      name: 'says nothing about a page carrying NO container, so the check costs nothing on the '
        + 'pages it was not written for',
      fn: async () => {
        expect(function checkNoContainers(): void {
          assertContainerIntegrity({
            slices: [
              rangeOf({
                startOffset: 0,
                endOffset: TARGET_TEXT.length,
              },),
            ],
            containers: [],
          },);
        },).not.toThrow();
      },
    },),
    it({
      name: 'says nothing about an ANCHOR, which replaces no range and so can break no element: '
        + 'where an insertion lands inside a container is a placement question answered elsewhere',
      fn: async () => {
        expect(function checkAnchor(): void {
          assertContainerIntegrity({
            slices: [
              {
                source: {
                  chunkIndex: 0,
                  nodes: [],
                  startOffset: 0,
                  endOffset: 0,
                  text: '猫猫也喜欢晒太阳。',
                },
                target: makeInsertionChunk({
                  chunkIndex: 0,
                  offset: onlyContainer()
                    .openerEndOffset,
                },),
              },
            ],
            containers: TARGET_CONTAINERS,
          },);
        },).not.toThrow();
      },
    },),
  ],
},);
