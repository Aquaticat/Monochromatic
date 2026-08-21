/**
 * Tests for the pieces every two-way contest shares.
 *
 * WHAT THIS FILE EXISTS TO STOP. These were private to the lane contest until a
 * second contest needed the same question over a different pair of names.
 * Sharing them is only safe while the reading stays vocabulary-agnostic, so
 * these exercise it on a vocabulary the lane contest never sees.
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
  CONTEST_POLICY,
  CONTEST_REFUSAL,
  contestResponseFormat,
  isStringList,
  namesOneOf,
  readCandidateNames,
} from '../dist/final/node/index.mjs';

/**
 * A vocabulary neither shipped contest uses.
 */
const NAMES = [
  'tabby',
  'calico',
] as const;

await describe({
  name: 'CONTEST_POLICY',
  children: [
    it({
      name: 'REFUSES to name any candidate, which is what makes it shareable',
      fn: async () => {
        for (const name of [ 'repair', 'translate', 'consolidated', 'standing', ])
          expect(CONTEST_POLICY.includes(`"${name}"`,),).toBe(false,);
      },
    },),
    it({
      name: 'states that the original rather than the archive is the standard',
      fn: async () => {
        expect(CONTEST_POLICY,).toContain('THE ORIGINAL IS THE STANDARD',);
        expect(CONTEST_POLICY,).toContain('never against the archive rendering',);
      },
    },),
    it({
      name: 'states that a declared name is not an unsupported statement',
      fn: async () => {
        expect(CONTEST_POLICY,).toContain('DECLARED NAMES ARE ATTESTED FACTS',);
      },
    },),
    it({
      name: 'offers the refusal as a verdict rather than as a failure to answer',
      fn: async () => {
        expect(CONTEST_POLICY,).toContain(`"${CONTEST_REFUSAL}"`,);
        expect(CONTEST_POLICY,).toContain('a real verdict rather than a failure to answer',);
      },
    },),
  ],
},);

await describe({
  name: contestResponseFormat.name,
  children: [
    it({
      name: 'names each contest separately, so two stages stay distinguishable',
      fn: async () => {
        expect(contestResponseFormat({ schemaName: 'cat_contest', },)
          .json_schema
          .name,).toBe('cat_contest',);
      },
    },),
    it({
      name: 'requires every field a ballot is read from',
      fn: async () => {
        expect(contestResponseFormat({ schemaName: 'cat_contest', },)
          .json_schema
          .schema
          .required,).toEqual([ 'choice', 'unsupported', 'dropped', 'reason', ],);
      },
    },),
  ],
},);

await describe({
  name: isStringList.name,
  children: [
    it({
      name: 'ACCEPTS an empty list, since finding nothing is an answer',
      fn: async () => {
        expect(isStringList([],),).toBe(true,);
      },
    },),
    it({
      name: 'ACCEPTS strings saying anything at all, which is the whole point',
      fn: async () => {
        expect(isStringList([ 'napping in the sun', ],),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a list carrying anything but strings',
      fn: async () => {
        expect(isStringList([ 'tabby', 1, ],),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a value that is not a list',
      fn: async () => {
        expect(isStringList('tabby',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: namesOneOf.name,
  children: [
    it({
      name: 'ACCEPTS a name this contest allows',
      fn: async () => {
        expect(namesOneOf({
          value: 'calico',
          names: NAMES,
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a name from another contest',
      fn: async () => {
        expect(namesOneOf({
          value: 'repair',
          names: NAMES,
        },),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a value that is not text',
      fn: async () => {
        expect(namesOneOf({
          value: 1,
          names: NAMES,
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: readCandidateNames.name,
  children: [
    it({
      name: 'reads a bare name as naming that candidate',
      fn: async () => {
        expect(readCandidateNames({
          findings: [ 'calico', ],
          names: NAMES,
        },),).toEqual([ 'calico', ],);
      },
    },),
    it({
      name: 'reads an annotated name as naming that candidate',
      fn: async () => {
        expect(readCandidateNames({
          findings: [ 'tabby (invents an afternoon)', ],
          names: NAMES,
        },),).toEqual([ 'tabby', ],);
      },
    },),
    it({
      name: 'REFUSES a longer word that merely begins with a name',
      fn: async () => {
        expect(readCandidateNames({
          findings: [ 'tabbyish wording', ],
          names: NAMES,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'ACCEPTS a finding naming nobody by blaming nobody',
      fn: async () => {
        expect(readCandidateNames({
          findings: [ 'the second bowl', ],
          names: NAMES,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'returns names in the order the contest fixed, without repeats',
      fn: async () => {
        expect(readCandidateNames({
          findings: [ 'calico drops it', 'tabby adds it', 'calico again', ],
          names: NAMES,
        },),).toEqual([ 'tabby', 'calico', ],);
      },
    },),
    it({
      name: 'ACCEPTS surrounding space and mixed case around a name',
      fn: async () => {
        expect(readCandidateNames({
          findings: [ '  Calico is missing the ledge  ', ],
          names: NAMES,
        },),).toEqual([ 'calico', ],);
      },
    },),
  ],
},);
