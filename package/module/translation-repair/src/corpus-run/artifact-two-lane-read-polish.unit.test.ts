/**
 * Tests generation-six final body polish artifact reader.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArtifactParseError,
  parseConsolidationPolish,
} from '../../dist/final/node/index.mjs';

/**
 * Settled polish record fixture.
 */
const SETTLED = {
  kind: 'settled',
  baseText: 'The cat faced life proactively.',
  proposedText: 'The cat maintained a positive outlook on life.',
  text: 'The cat maintained a positive outlook on life.',
  changed: true,
  refinersHeard: ['hf:zai-org/GLM-5.2',],
  contributors: ['hf:zai-org/GLM-5.2',],
  roundCount: 1,
  gate: {
    choice: 'polished',
    ships: 'polished',
    ballots: [
      {
        choice: 'polished',
        unsupported: [],
        unsupportedRaw: [],
        dropped: [],
        droppedRaw: [],
        reason: 'equally faithful and more idiomatic',
      },
    ],
    usable: 1,
    findings: [],
  },
  findings: [],
};

await describe({
  name: parseConsolidationPolish.name,
  children: [
    it({
      name: 'READS SETTLED POLISH and explicit syntax exclusion',
      fn: async () => {
        expect(parseConsolidationPolish({
          value: SETTLED,
          path: 'artifact.consolidation.slices[0].polish',
        },),).toEqual(SETTLED,);
        expect(parseConsolidationPolish({
          value: {
            kind: 'not-run',
            reason: 'front-matter',
          },
          path: 'artifact.consolidation.slices[0].polish',
        },),).toEqual({
          kind: 'not-run',
          reason: 'front-matter',
        },);
      },
    },),

    it({
      name: 'REFUSES CHANGED FLAG disagreeing with final text',
      fn: async () => {
        expect(() => parseConsolidationPolish({
          value: {
            ...SETTLED,
            changed: false,
          },
          path: 'artifact.consolidation.slices[0].polish',
        },),).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'REFUSES CHANGED POLISH WITHOUT FINAL GATE',
      fn: async () => {
        /**
         * Settled fields except required changed-polish gate.
         */
        const {
          gate: unusedGate,
          ...withoutGate
        } = SETTLED;
        expect(unusedGate,).not.toBeUndefined();
        expect(() => parseConsolidationPolish({
          value: withoutGate,
          path: 'artifact.consolidation.slices[0].polish',
        },),).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'REFUSES GATE CHOICE inconsistent with shipping role',
      fn: async () => {
        expect(() => parseConsolidationPolish({
          value: {
            ...SETTLED,
            gate: {
              ...SETTLED.gate,
              choice: 'polished',
              ships: 'base',
            },
          },
          path: 'artifact.consolidation.slices[0].polish',
        },),).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'REFUSES GATE USABLE COUNT disagreeing with ballots',
      fn: async () => {
        expect(() => parseConsolidationPolish({
          value: {
            ...SETTLED,
            gate: {
              ...SETTLED.gate,
              usable: 2,
            },
          },
          path: 'artifact.consolidation.slices[0].polish',
        },),).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'REFUSES UNKNOWN POLISH KEY under exact schema',
      fn: async () => {
        expect(() => parseConsolidationPolish({
          value: {
            ...SETTLED,
            extra: true,
          },
          path: 'artifact.consolidation.slices[0].polish',
        },),).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);
