/**
 * Tests for what a roster's coverage replies add up to.
 *
 * The asymmetry these pin: coverage can be proven, by pointing at the English
 * carrying the passage, and absence cannot be, since nothing exhibits text that
 * is not there. A claim nobody can anchor is therefore neither proof of coverage
 * nor a vote for absence.
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
  type CoverageReportWire,
  type HeardVoice,
  isCoverageReportWire,
  judgeCoverage,
  parseDocument,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Translation every quote is checked against.
 */
const TARGET_TEXT = `The cat sleeps on the windowsill each morning and naps on its cushion at noon.

She watches the birds outside.
`;

/**
 * That translation as an anchor target.
 */
const TARGET = {
  text: TARGET_TEXT,
  nodes: parseDocument({ text: TARGET_TEXT, },).nodes,
};

/**
 * Builds one heard voice carrying a coverage reply.
 *
 * @param modelId - roster member the reply came from
 *
 * @param coverage - degree it claims
 *
 * @param quote - English it points at
 *
 * @returns Voice shaped as the roster returns them
 *
 * @example
 * ```ts
 * const voice = voiceOf({ modelId: 'hf:cat/Cat-A' as SyntheticModelId, coverage: 'none', quote: '', },);
 * ```
 */
function voiceOf(
  {
    modelId,
    coverage,
    quote,
  }: {
    readonly modelId: SyntheticModelId;
    readonly coverage: CoverageReportWire['coverage'];
    readonly quote: string;
  },
): HeardVoice<CoverageReportWire> {
  return {
    modelId,
    value: {
      coverage,
      quote,
      reason: 'fixture',
    },
  };
}

await describe({
  name: judgeCoverage.name,
  children: [
    it({
      name: 'reports CARRIED when a majority point at English the document really holds, which is the '
        + 'shape of a passage the translation merged into a neighbouring sentence rather than omitted',
      fn: async () => {
        const verdict = judgeCoverage({
          voices: [
            voiceOf({
              modelId: 'hf:cat/Cat-A' as SyntheticModelId,
              coverage: 'full',
              quote: 'naps on its cushion at noon',
            },),
            voiceOf({
              modelId: 'hf:cat/Cat-B' as SyntheticModelId,
              coverage: 'partial',
              quote: 'The cat sleeps on the windowsill each morning',
            },),
            voiceOf({
              modelId: 'hf:cat/Cat-C' as SyntheticModelId,
              coverage: 'none',
              quote: '',
            },),
          ],
          document: TARGET,
        },);
        expect(verdict.kind,).toBe('carried',);
        expect(verdict.anchored,).toBe(2,);
        expect(verdict.absent,).toBe(1,);
        expect(verdict.evidence
          .length,).toBe(2,);
      },
    },),
    it({
      name: 'reports ABSENT when a majority find nothing, which is the only evidence absence can ever '
        + 'have: no reader can exhibit text that is not there',
      fn: async () => {
        const verdict = judgeCoverage({
          voices: [
            voiceOf({
              modelId: 'hf:cat/Cat-A' as SyntheticModelId,
              coverage: 'none',
              quote: '',
            },),
            voiceOf({
              modelId: 'hf:cat/Cat-B' as SyntheticModelId,
              coverage: 'none',
              quote: '',
            },),
            voiceOf({
              modelId: 'hf:cat/Cat-C' as SyntheticModelId,
              coverage: 'full',
              quote: 'She watches the birds outside.',
            },),
          ],
          document: TARGET,
        },);
        expect(verdict.kind,).toBe('absent',);
        expect(verdict.absent,).toBe(2,);
        expect(verdict.anchored,).toBe(1,);
      },
    },),
    it({
      name: 'DROPS a claim quoting English the document does not hold, and does not count it for '
        + 'absence either: a bad quote is a voice that answered unusably, and reading it as agreement '
        + 'with "nothing carries this" would turn an invented quote into a reason to insert text',
      fn: async () => {
        const verdict = judgeCoverage({
          voices: [
            voiceOf({
              modelId: 'hf:cat/Cat-A' as SyntheticModelId,
              coverage: 'full',
              quote: 'The kitten chases butterflies in the yard.',
            },),
            voiceOf({
              modelId: 'hf:cat/Cat-B' as SyntheticModelId,
              coverage: 'full',
              quote: 'She purrs by the fire.',
            },),
            voiceOf({
              modelId: 'hf:cat/Cat-C' as SyntheticModelId,
              coverage: 'none',
              quote: '',
            },),
          ],
          document: TARGET,
        },);
        expect(verdict.unanchored,).toBe(2,);
        expect(verdict.anchored,).toBe(0,);
        expect(verdict.absent,).toBe(1,);
        // NOT absent, though the only usable voice said so: one voice of three
        // is not a majority, and two unusable answers do not make it one.
        expect(verdict.kind,).toBe('split',);
      },
    },),
    it({
      name: 'reports SPLIT when neither side reaches a majority of the voices heard, so a passage the '
        + 'roster disagrees about is never inserted on a plurality',
      fn: async () => {
        const verdict = judgeCoverage({
          voices: [
            voiceOf({
              modelId: 'hf:cat/Cat-A' as SyntheticModelId,
              coverage: 'full',
              quote: 'She watches the birds outside.',
            },),
            voiceOf({
              modelId: 'hf:cat/Cat-B' as SyntheticModelId,
              coverage: 'none',
              quote: '',
            },),
          ],
          document: TARGET,
        },);
        expect(verdict.kind,).toBe('split',);
      },
    },),
    it({
      name: 'anchors a quote that differs only in curly versus straight punctuation, since a model '
        + 'copying English out of a prompt normalises quotation marks and an archive uses both',
      fn: async () => {
        /** Translation carrying a curly apostrophe. */
        const curlyText = 'The cat’s cushion is warm at noon.\n';
        const verdict = judgeCoverage({
          voices: [
            voiceOf({
              modelId: 'hf:cat/Cat-A' as SyntheticModelId,
              coverage: 'full',
              quote: "The cat's cushion is warm at noon.",
            },),
          ],
          document: {
            text: curlyText,
            nodes: parseDocument({ text: curlyText, },).nodes,
          },
        },);
        expect(verdict.anchored,).toBe(1,);
        expect(verdict.kind,).toBe('carried',);
      },
    },),
  ],
},);

await describe({
  name: isCoverageReportWire.name,
  children: [
    it({
      name: 'REFUSES a claim of coverage with no quote, rather than counting it: the quote is the only '
        + 'part of this reply anything can check, so a reply without one carries no evidence and the '
        + 'roster should ask that model again rather than record it as answered',
      fn: async () => {
        expect(isCoverageReportWire({
          coverage: 'full',
          quote: '',
          reason: 'it is in there somewhere',
        },),).toBe(false,);
        expect(isCoverageReportWire({
          coverage: 'partial',
          quote: '   ',
          reason: 'whitespace is not evidence',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a report of no coverage that still quotes something, since the two fields '
        + 'contradict each other and neither can be trusted over the other',
      fn: async () => {
        expect(isCoverageReportWire({
          coverage: 'none',
          quote: 'She watches the birds outside.',
          reason: 'contradicts itself',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'accepts the two shapes that agree with themselves, and refuses a degree outside the three '
        + 'the sheet asks for',
      fn: async () => {
        expect(isCoverageReportWire({
          coverage: 'none',
          quote: '',
          reason: 'nothing renders it',
        },),).toBe(true,);
        expect(isCoverageReportWire({
          coverage: 'full',
          quote: 'She watches the birds outside.',
          reason: 'rendered here',
        },),).toBe(true,);
        expect(isCoverageReportWire({
          coverage: 'mostly',
          quote: 'She watches the birds outside.',
          reason: 'not one of the three',
        },),).toBe(false,);
      },
    },),
  ],
},);
