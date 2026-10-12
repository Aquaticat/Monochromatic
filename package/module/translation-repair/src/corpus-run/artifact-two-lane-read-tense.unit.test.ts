/**
 Tests for reading the tense candidates a contest slice records.

 WHAT IS UNDER TEST is what the reader refuses. The finding is an audit trail
 for a page read, so a record that the writer could not have produced must stop
 the read at its own path rather than reach a count as a candidate.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArtifactParseError,
  parseRecordedTenseCandidates,
} from '../../dist/final/node/index.mjs';

/**
 Path every message under test is built against.
 */
const TENSE_PATH = 'CatEntry1.tenseCandidates';

/**
 One candidate as the writer records it.
 */
const NAPS = {
  sentence: 'Mittens naps in the bookshop attic.',
  matched: 'Mittens naps',
  rule: 's-ending-verb',
};

/**
 Reads a value and returns the refusal it raised.

 @param value - recorded value handed to the reader

 @returns What the reader threw

 @example
 ```ts
 const refusal = refusalOf({ value: 'naps', },);
 ```
 */
function refusalOf({ value, }: { readonly value: unknown; },): unknown {
  return caught(function readRecorded() {
    return parseRecordedTenseCandidates({
      value,
      path: TENSE_PATH,
    },);
  },);
}

/**
 Reads a value and returns the text of the refusal it raised.

 @param value - recorded value handed to the reader

 @returns The refusal as text, class name first

 @example
 ```ts
 const text = refusalTextOf({ value: 'naps', },);
 ```
 */
function refusalTextOf({ value, }: { readonly value: unknown; },): string {
  return String(refusalOf({ value, },),);
}

//region Recorded tense candidates tests

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: parseRecordedTenseCandidates.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS an empty record and a group of candidates as they were written, in recorded order, naming each of the four rules',
          fn: async () => {
            expect(parseRecordedTenseCandidates({
              value: [],
              path: TENSE_PATH,
            },),).toEqual([],);
            /**
             A group holding one candidate under each rule the detector writes.
             */
            const group = {
              label: 'CANDIDATE "repair"',
              found: [
                'contraction',
                'copula-or-auxiliary',
                's-ending-verb',
                'bare-verb',
              ].map(function candidateOf(rule,) {
                return {
                  ...NAPS,
                  rule,
                };
              },),
            };
            expect(parseRecordedTenseCandidates({
              value: [
                group,
                {
                  label: 'ARCHIVE RENDERING',
                  found: [],
                },
              ],
              path: TENSE_PATH,
            },),).toEqual([
              group,
              {
                label: 'ARCHIVE RENDERING',
                found: [],
              },
            ],);
          },
        },),

        it({
          name: 'REFUSES a record that is not a list, naming the path',
          fn: async () => {
            expect(refusalOf({ value: 'naps', },),).toBeInstanceOf(ArtifactParseError,);
            expect(refusalTextOf({ value: 'naps', },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates: expected an array.',
            );
          },
        },),

        it({
          name: 'REFUSES a group that is not an object, and one without a text label',
          fn: async () => {
            expect(refusalTextOf({ value: ['naps',], },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0]: expected an object.',
            );
            expect(refusalTextOf({ value: [{ found: [], },], },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].label: expected a string.',
            );
          },
        },),

        it({
          name: 'REFUSES a group whose candidates are not a list, and a candidate that is not an object',
          fn: async () => {
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: 'naps',
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].found: expected an array.',
            );
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: ['naps',],
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].found[0]: expected an object.',
            );
          },
        },),

        it({
          name: 'REFUSES a candidate missing its sentence, or holding a matched text or a rule that is no string',
          fn: async () => {
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: [{
                  matched: NAPS.matched,
                  rule: NAPS.rule,
                },],
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].found[0].sentence: expected a string.',
            );
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: [{
                  ...NAPS,
                  matched: 1,
                },],
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].found[0].matched: expected a string.',
            );
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: [{
                  ...NAPS,
                  rule: 1,
                },],
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].found[0].rule: expected a string.',
            );
          },
        },),

        it({
          name: 'REFUSES a candidate naming a rule the detector never writes',
          fn: async () => {
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: [{
                  ...NAPS,
                  rule: 'guess',
                },],
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].found[0].rule: '
                + 'expected a present-tense rule the detector writes.',
            );
          },
        },),

        it({
          name: 'REFUSES a group or a candidate carrying a key the writer never records',
          fn: async () => {
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: [],
                verdict: 'flawed',
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].verdict: '
                + 'expected no key here beyond label, found.',
            );
            expect(refusalTextOf({
              value: [{
                label: 'ARCHIVE RENDERING',
                found: [{
                  ...NAPS,
                  severity: 'major',
                },],
              },],
            },),).toBe(
              'ArtifactParseError: artifact parse failed at CatEntry1.tenseCandidates[0].found[0].severity: '
                + 'expected no key here beyond sentence, matched, rule.',
            );
          },
        },),
      ],
    },),
  ],
},);

//endregion Recorded tense candidates tests
