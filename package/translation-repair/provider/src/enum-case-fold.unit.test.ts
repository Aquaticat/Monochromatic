/**
 Tests for the rule that takes a reply value differing from a listed `enum` or `const` value only in capitalization back
 to the schema's own spelling, on the value alone: the readings that carry it into a log line and an outcome are in
 `chat-json-outcome-case.unit.test.ts`.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { foldEnumCase, } from '../dist/final/node/index.mjs';

/**
 Schema of a reply with a list of findings, each with a severity the schema lists.
 */
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    mood: { type: 'string', enum: ['calm', 'not calm',], },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['minor', 'major',], },
          note: { type: 'string', },
        },
      },
    },
  },
};

await describe({
  name: foldEnumCase.name,
  concurrency: 1,
  children: [
    it({
      name: 'TAKES THE LISTED SPELLING of a string that differs only in capitalization, and names where it sat',
      fn: async () => {
        expect(foldEnumCase({
          schema: FINDINGS_SCHEMA,
          value: { mood: 'Calm', findings: [], },
        },),).toEqual({
          value: {
            mood: 'calm',
            findings: [],
          },
          folds: [
            {
              path: 'reply.mood',
              received: 'Calm',
              taken: 'calm',
            },
          ],
        },);
        expect(foldEnumCase({
          schema: FINDINGS_SCHEMA,
          value: { mood: 'not Calm', },
        },).value,).toEqual({ mood: 'not calm', },);
      },
    },),

    it({
      name: 'NAMES THE POSITION OF A LIST MEMBER in the path, and leaves the members the schema lists exactly',
      fn: async () => {
        expect(foldEnumCase({
          schema: FINDINGS_SCHEMA,
          value: {
            findings: [
              {
                severity: 'minor',
                note: 'Purr',
              },
              {
                severity: 'MAJOR',
                note: 'Hiss',
              },
            ],
          },
        },),).toEqual({
          value: {
            findings: [
              {
                severity: 'minor',
                note: 'Purr',
              },
              {
                severity: 'major',
                note: 'Hiss',
              },
            ],
          },
          folds: [
            {
              path: 'reply.findings[1].severity',
              received: 'MAJOR',
              taken: 'major',
            },
          ],
        },);
      },
    },),

    it({
      name: 'HANDS BACK THE SAME OBJECT where nothing was taken back, and never changes the value handed in',
      fn: async () => {
        /**
         A reply the schema lists exactly.
         */
        const exact = {
          mood: 'calm',
          findings: [{ severity: 'minor', },],
        };
        expect(foldEnumCase({
          schema: FINDINGS_SCHEMA,
          value: exact,
        },).value,).toBe(exact,);

        /**
         A reply with one capital to take back.
         */
        const capitalised = {
          mood: 'Calm',
          findings: [{ severity: 'minor', },],
        };
        const { value, } = foldEnumCase({
          schema: FINDINGS_SCHEMA,
          value: capitalised,
        },);
        expect(value,).not.toBe(capitalised,);
        expect(capitalised.mood,).toBe('Calm',);
      },
    },),

    it({
      name: 'KEEPS A STRING NO LISTED VALUE MATCHES, and one that SEVERAL LISTED VALUES MATCH',
      fn: async () => {
        expect(foldEnumCase({
          schema: FINDINGS_SCHEMA,
          value: { mood: 'sleepy', },
        },),).toEqual({
          value: { mood: 'sleepy', },
          folds: [],
        },);
        expect(foldEnumCase({
          schema: {
            type: 'object',
            properties: { mood: { enum: ['calm', 'Calm', 'not calm',], }, },
          },
          value: { mood: 'CALM', },
        },),).toEqual({
          value: { mood: 'CALM', },
          folds: [],
        },);
      },
    },),

    it({
      name: 'TAKES THE SPELLING OF A LISTED VALUE ONCE where the schema lists it twice',
      fn: async () => {
        expect(foldEnumCase({
          schema: {
            type: 'object',
            properties: { mood: { enum: ['calm', 'calm',], }, },
          },
          value: { mood: 'Calm', },
        },).value,).toEqual({ mood: 'calm', },);
      },
    },),

    it({
      name: 'READS A `const` AS A LIST OF ONE, and ignores a member of an enum that is not a string',
      fn: async () => {
        expect(foldEnumCase({
          schema: {
            type: 'object',
            properties: { kind: { const: 'ballot', }, size: { enum: [1, 2,], }, },
          },
          value: { kind: 'Ballot', size: 1, },
        },).value,).toEqual({ kind: 'ballot', size: 1, },);
      },
    },),

    it({
      name: 'LEAVES A PROPERTY THE SCHEMA DOES NOT DESCRIBE, a node that lists nothing, and a value of another kind',
      fn: async () => {
        expect(foldEnumCase({
          schema: FINDINGS_SCHEMA,
          value: {
            other: 'Calm',
            findings: 'Calm',
          },
        },),).toEqual({
          value: {
            other: 'Calm',
            findings: 'Calm',
          },
          folds: [],
        },);
        expect(foldEnumCase({
          schema: { type: 'string', },
          value: 'Calm',
        },),).toEqual({
          value: 'Calm',
          folds: [],
        },);
        expect(foldEnumCase({
          schema: { enum: ['calm',], },
          value: 3,
        },),).toEqual({
          value: 3,
          folds: [],
        },);
      },
    },),

    it({
      name: 'READS THE REPLY ITSELF when the schema lists its values, at the path reply',
      fn: async () => {
        expect(foldEnumCase({
          schema: { enum: ['calm', 'not calm',], },
          value: 'Not calm',
        },),).toEqual({
          value: 'not calm',
          folds: [
            {
              path: 'reply',
              received: 'Not calm',
              taken: 'not calm',
            },
          ],
        },);
      },
    },),
  ],
},);
