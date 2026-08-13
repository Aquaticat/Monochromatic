/**
 * Tests for section chunking and total automatic alignment:
 * heading-bounded partition, preamble handling, exact offsets, mirrored
 * index pairing, and proportional merging over mismatched structures.
 * Fixtures are cat-themed invention only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  alignDocumentSections,
  chunkByHeadings,
  parseDocument,
} from '../dist/final/node/index.mjs';

/**
 * Two-section fixture with front matter and a preamble paragraph.
 */
const SOURCE_FIXTURE = `---
name: whiskers
---

开场白：猫猫登场。

## 简介

猫猫喜欢晒太阳。

猫猫也追蝴蝶。

## 习性

> 「喵。」
`;

/**
 * Mirrored translation fixture with identical block structure.
 */
const TARGET_FIXTURE = `---
name: whiskers
---

Prologue: the cat arrives.

## Introduction

The cat loves sunbathing.

The cat also chases butterflies.

## Habits

> "Meow."
`;

/**
 * Translation fixture whose extra section breaks the mirror:
 * same preamble shape, but three sections against the source's two.
 */
const EXTRA_SECTION_FIXTURE = `---
name: whiskers
---

Prologue: the cat arrives.

## Introduction

The cat loves sunbathing.

## Habits

The cat also chases butterflies.

## Legacy

> "Meow."
`;

await describe({
  name: chunkByHeadings.name,
  children: [
    it({
      name: 'partitions nodes into preamble and heading-bounded chunks',
      fn: async () => {
        /** Parsed source fixture. */
        const doc = parseDocument({ text: SOURCE_FIXTURE, },);
        /** Chunks of the source fixture. */
        const chunks = chunkByHeadings({ document: doc, },);

        expect(chunks.map(function toLeadingKind(chunk,): string {
          return chunk.nodes[0]?.kind ?? '';
        },),).toEqual(['paragraph', 'heading', 'heading',],);
        expect(chunks.map(function toNodeCount(chunk,): number {
          return chunk.nodes.length;
        },),).toEqual([1, 3, 2,],);
        // Every node lands in exactly one chunk, order preserved.
        expect(chunks.flatMap(function toNodes(chunk,) {
          return chunk.nodes;
        },),).toEqual(doc.nodes,);
      },
    },),

    it({
      name: 'slices chunk text exactly from node offsets',
      fn: async () => {
        /** Parsed source fixture. */
        const doc = parseDocument({ text: SOURCE_FIXTURE, },);
        for (const chunk of chunkByHeadings({ document: doc, },)) {
          expect(chunk.text,).toBe(doc.text.slice(
            chunk.startOffset,
            chunk.endOffset,
          ),);
          expect(chunk.text.startsWith(chunk.nodes[0]?.text ?? '',),).toBe(true,);
        }
      },
    },),

    it({
      name: 'returns no chunks for an empty body',
      fn: async () => {
        expect(chunkByHeadings({
          document: parseDocument({ text: '---\nname: n\n---\n', },),
        },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: alignDocumentSections.name,
  children: [
    it({
      name: 'pairs mirrored documents index by index without findings',
      fn: async () => {
        /** Alignment of the mirrored fixtures. */
        const alignment = alignDocumentSections({
          source: parseDocument({ text: SOURCE_FIXTURE, },),
          target: parseDocument({ text: TARGET_FIXTURE, },),
        },);

        expect(alignment.findings,).toEqual([],);
        expect(alignment.pairs,).toHaveLength(3,);
        expect(alignment.pairs[1]?.source.nodes[0]?.kind,).toBe('heading',);
        expect(alignment.pairs[1]?.target.nodes[0]?.kind,).toBe('heading',);
      },
    },),

    it({
      name: 'REFUSES sections it cannot pair rather than merging them '
        + 'proportionally, and the document still settles. Proportional merging '
        + 'produced a confident wrong pairing, which fed critics the wrong '
        + 'original and made every issue filed on that entry noise',
      fn: async () => {
        /**
         * Sides whose section counts differ and whose headings share nothing.
         */
        const alignment = alignDocumentSections({
          source: parseDocument({ text: SOURCE_FIXTURE, },),
          target: parseDocument({ text: EXTRA_SECTION_FIXTURE, },),
        },);

        // Nothing is forced, so nothing is paired, and that is the point.
        expect(alignment.pairs,).toHaveLength(0,);
        expect(alignment.findings.map(function toKind(finding,): string {
          return finding.kind;
        },),).toContain('structure-mismatch',);
      },
    },),

    it({
      name: 'NEVER blocks: a document the aligner cannot pair at all still '
        + 'returns, with findings and no pairs, because the pipeline yields '
        + 'output for every entry whatever the input and an entry that refuses '
        + 'to settle vanishes from every measurement silently',
      fn: async () => {
        /**
         * One-section source against a three-section target, sharing nothing.
         */
        const alignment = alignDocumentSections({
          source: parseDocument({ text: '## 简介\n\n猫猫喜欢晒太阳。\n', },),
          target: parseDocument({
            text: '## One\n\nA cat.\n\n## Two\n\nAnother cat.\n\n## Three\n\nThird cat.\n',
          },),
        },);

        expect(alignment.pairs,).toHaveLength(0,);
        expect(alignment.findings.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'PAIRS a leading-kind mismatch with equal counts instead of '
        + 'reporting a structure mismatch. That report was spurious: with one '
        + 'chunk on each side the old test could only fail on leading node '
        + 'kinds, so it described an asymmetric preamble and called it structure',
      fn: async () => {
        /**
         * Preamble-led source against a headings-only target, equal counts.
         */
        const alignment = alignDocumentSections({
          source: parseDocument({ text: SOURCE_FIXTURE, },),
          target: parseDocument({
            text: '## One\n\nA cat.\n\n## Two\n\nAnother cat.\n\n## Three\n\nThird cat.\n',
          },),
        },);

        expect(alignment.pairs,).toHaveLength(3,);
        expect(alignment.findings,).toHaveLength(0,);
      },
    },),
  ],
},);
