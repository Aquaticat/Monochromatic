/**
 * Tests for critic wire guarding and quote-to-anchor resolution.
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
  type CriticIssueWire,
  isCriticReportWire,
  resolveCriticIssue,
} from './critic-wire.ts';
import { parseDocument, } from './parse-document.ts';

/**
 * Parsed pair resolutions anchor against.
 */
const DOCUMENTS = {
  source: parseDocument({
    text: '---\nname: 小猫-whiskers\n---\n\n## 简介\n\n猫猫喜欢晒太阳，也喜欢追蝴蝶。\n\n猫猫会打呼噜。\n',
  },),
  target: parseDocument({
    text: '---\nname: 小猫-whiskers\n---\n\n## Introduction\n\nThe cat likes to nap in the sun.\n\nThe cat purrs.\n',
  },),
} as const;

/**
 * Fully valid wire issue used as the base for corruptions.
 */
const VALID_WIRE: CriticIssueWire = {
  category: 'accuracy/omission',
  severity: 'major',
  summary: '追蝴蝶那句没有翻译。',
  sourceQuote: '也喜欢追蝴蝶',
  targetQuote: 'The cat likes to nap in the sun.',
};

await describe({
  name: isCriticReportWire.name,
  children: [
    it({
      name: 'accepts well-formed reports including empty ones',
      fn: async () => {
        expect(isCriticReportWire({ issues: [], },),).toBe(true,);
        expect(isCriticReportWire({ issues: [VALID_WIRE,], },),).toBe(true,);
        expect(isCriticReportWire({
          issues: [{ category: 'x', severity: 'y', summary: 'z', },],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'rejects malformed reports',
      fn: async () => {
        expect(isCriticReportWire({},),).toBe(false,);
        expect(isCriticReportWire({ issues: 'many', },),).toBe(false,);
        expect(isCriticReportWire({ issues: [{ category: 1, },], },),).toBe(false,);
        expect(isCriticReportWire({
          issues: [{ category: 'x', severity: 'y', summary: 'z', targetQuote: 7, },],
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: resolveCriticIssue.name,
  children: [
    it({
      name: 'resolves dual quotes into a validated anchored claim',
      fn: async () => {
        /** Resolution of the fully valid wire issue. */
        const resolution = resolveCriticIssue({
          wire: VALID_WIRE,
          documents: DOCUMENTS,
        },);
        expect(resolution.resolved,).toBe(true,);
        if (resolution.resolved) {
          expect(resolution.claim.spans,).toHaveLength(2,);
          expect(resolution.claim.spans[0]?.side,).toBe('source',);
          expect(resolution.claim.spans[1]?.side,).toBe('target',);
          expect(resolution.claim.spans[1]?.quotedText,)
            .toBe('The cat likes to nap in the sun.',);
        }
      },
    },),

    it({
      name: 'fails closed vocabularies, missing quotes, and empty quotes',
      fn: async () => {
        /**
         * Reads the failure reason of one corrupted wire.
         *
         * @param wire - corrupted wire under test
         *
         * @returns Failure reason, empty when resolution unexpectedly succeeded
         *
         * @example
         * ```ts
         * reasonOf({ ...VALID_WIRE, category: 'accuracy/vibes', },);
         * ```
         */
        function reasonOf(wire: CriticIssueWire,): string {
          /** Resolution of the corrupted wire. */
          const resolution = resolveCriticIssue({
            wire,
            documents: DOCUMENTS,
          },);
          return resolution.resolved
            ? ''
            : resolution.reason;
        }

        expect(reasonOf({ ...VALID_WIRE, category: 'accuracy/vibes', },),)
          .toContain('unknown-category',);
        expect(reasonOf({ ...VALID_WIRE, severity: 'apocalyptic', },),)
          .toContain('unknown-severity',);
        expect(reasonOf({
          category: 'accuracy/omission',
          severity: 'major',
          summary: 'no anchors at all',
        },),).toBe('no-quotes',);
        expect(reasonOf({
          category: 'accuracy/omission',
          severity: 'major',
          summary: 'empty target evidence',
          targetQuote: '',
        },),).toContain('empty-quote',);
      },
    },),

    it({
      name: 'fails absent, ambiguous, and outside-block quotes',
      fn: async () => {
        /**
         * Reads the failure reason of one corrupted wire.
         *
         * @param wire - corrupted wire under test
         *
         * @returns Failure reason, empty when resolution unexpectedly succeeded
         *
         * @example
         * ```ts
         * reasonOf({ ...VALID_WIRE, category: 'accuracy/vibes', },);
         * ```
         */
        function reasonOf(wire: CriticIssueWire,): string {
          /** Resolution of the corrupted wire. */
          const resolution = resolveCriticIssue({
            wire,
            documents: DOCUMENTS,
          },);
          return resolution.resolved
            ? ''
            : resolution.reason;
        }

        expect(reasonOf({ ...VALID_WIRE, targetQuote: 'The dog barks.', },),)
          .toBe('quote-not-found (target)',);
        expect(reasonOf({ ...VALID_WIRE, targetQuote: 'The cat', },),)
          .toBe('ambiguous-quote (target)',);
        // Front matter text locates uniquely but belongs to no block node.
        expect(reasonOf({
          ...VALID_WIRE,
          targetQuote: 'name: 小猫-whiskers',
        },),).toBe('quote-outside-blocks (target)',);
      },
    },),

    it({
      name: 'splits block-crossing quotes into per-node spans',
      fn: async () => {
        /** Resolution of a quote spanning two paragraphs. */
        const resolution = resolveCriticIssue({
          wire: {
            category: VALID_WIRE.category,
            severity: VALID_WIRE.severity,
            summary: VALID_WIRE.summary,
            targetQuote: 'in the sun.\n\nThe cat purrs.',
          },
          documents: DOCUMENTS,
        },);

        expect(resolution.resolved,).toBe(true,);
        if (resolution.resolved) {
          expect(resolution.claim.spans,).toHaveLength(2,);
          expect(resolution.claim.spans[0]?.quotedText,).toBe('in the sun.',);
          expect(resolution.claim.spans[1]?.quotedText,).toBe('The cat purrs.',);
          expect(resolution.claim.spans[0]?.nodeId,)
            .not
            .toBe(resolution.claim.spans[1]?.nodeId,);
        }
      },
    },),

    it({
      name: 'rescues punctuation-variant quotes with canonical document bytes',
      fn: async () => {
        /** Pair whose translation uses curly punctuation. */
        const documents = {
          source: DOCUMENTS.source,
          target: parseDocument({
            text: '## Introduction\n\nThe cat’s sunbeam is “warm” today.\n',
          },),
        } as const;
        /** Resolution of an ASCII-punctuation quote. */
        const resolution = resolveCriticIssue({
          wire: {
            category: VALID_WIRE.category,
            severity: VALID_WIRE.severity,
            summary: VALID_WIRE.summary,
            targetQuote: 'The cat\'s sunbeam is "warm" today.',
          },
          documents,
        },);

        expect(resolution.resolved,).toBe(true,);
        if (resolution.resolved) {
          // The anchor carries the document's canonical curly bytes.
          expect(resolution.claim.spans[0]?.quotedText,)
            .toBe('The cat’s sunbeam is “warm” today.',);
        }
      },
    },),

    it({
      name: 'remaps known leaves reported under the wrong family',
      fn: async () => {
        /** Resolution of a family-slipped category. */
        const resolution = resolveCriticIssue({
          wire: {
            ...VALID_WIRE,
            category: 'fluency/awkward-phrasing',
          },
          documents: DOCUMENTS,
        },);
        expect(resolution.resolved,).toBe(true,);
        if (resolution.resolved)
          expect(resolution.claim.category,).toBe('style/awkward-phrasing',);
      },
    },),
  ],
},);
