/**
 Tests for reading back a carry whose choice was run off (the lead's adoption of 2026-10-15 of the owner's rule of 2026-10-11
 for this ask): the artifact keeps the run-off beside the first count, and the reader recounts both, so a run-off that does
 not follow from the first count, or a decision that does not follow from the run-off, is refused. A carry recorded
 without a run-off, as the earlier runs recorded a split, is still read as it was.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactConsistencyCarry,
  assertCarriesRecount,
  parseConsistencyCarry,
} from '../../dist/final/node/index.mjs';
import { recountRefusalOf, } from './consistency-refusal.test-fixture.ts';

/**
 Builds one recorded choice.

 @param seat - seat that answered
 @param choice - label chosen

 @returns The recorded choice

 @example
 ```ts
 const ballot = ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 3', },);
 ```
 */
function ballotOf({ seat, choice, }: { readonly seat: string; readonly choice: string; },): ArtifactConsistencyCarry['ballots'][number] {
  return { seat, reason: 'It words the original best.', choice, };
}

/**
 The run-off of a three-way split: all three candidates tied, and the third won two of three.
 */
const RUN_OFF: NonNullable<ArtifactConsistencyCarry['runOff']> = {
  finalists: ['CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3',],
  ballots: [
    ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 3', },),
    ballotOf({ seat: 'bedrock-cat', choice: 'CANDIDATE 3', },),
    ballotOf({ seat: 'vision-cat', choice: 'CANDIDATE 2', },),
  ],
  usable: 3,
  quorum: 2,
};

/**
 A carry whose three choices split three ways and whose run-off chose the third candidate.
 */
const RUN_OFF_CARRY: ArtifactConsistencyCarry = {
  label: 'OCCURRENCE 2',
  candidates: [
    { label: 'CANDIDATE 1', kind: 'current', writers: [], text: 'The kitten naps.', },
    { label: 'CANDIDATE 2', kind: 'splice', writers: [], text: 'The cat naps.', },
    { label: 'CANDIDATE 3', kind: 'writer', writers: ['hyper-cat',], text: 'The cat dozes.', },
  ],
  ballots: [
    ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 1', },),
    ballotOf({ seat: 'bedrock-cat', choice: 'CANDIDATE 2', },),
    ballotOf({ seat: 'vision-cat', choice: 'CANDIDATE 3', },),
  ],
  usable: 3,
  quorum: 2,
  runOff: RUN_OFF,
  decision: { kind: 'chosen', label: 'CANDIDATE 3', },
};

/**
 A value as the artifact stores it and a resumed run reads it back: through JSON, whose semantics are the point.

 @param value - value as built

 @returns The value read back from its JSON text

 @example
 ```ts
 const stored = asStored({ value: RUN_OFF_CARRY, },);
 ```
 */
function asStored({ value, }: { readonly value: unknown; },): unknown {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON semantics are the point: the artifact is written as JSON, so a key whose value is undefined must drop and a field JSON cannot hold must fail here, both of which structuredClone would hide.
  return JSON.parse(JSON.stringify(value,),);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: parseConsistencyCarry.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE RUN-OFF OF A CARRY BESIDE ITS FIRST COUNT, and a carry without one as before',
          fn: async () => {
            expect(parseConsistencyCarry({ value: asStored({ value: RUN_OFF_CARRY, },), path: 'cat', },),).toEqual(
              RUN_OFF_CARRY,
            );
            const { runOff: _runOff, ...without } = RUN_OFF_CARRY;
            expect(
              parseConsistencyCarry({
                value: asStored({ value: { ...without, decision: { kind: 'none', reason: 'no-majority', }, }, },),
                path: 'cat',
              },),
            ).toEqual({ ...without, decision: { kind: 'none', reason: 'no-majority', }, },);
          },
        },),
      ],
    },),
    describe({
      name: assertCarriesRecount.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ACCEPTS A CARRY WHOSE RUN-OFF FOLLOWS FROM THE TIE OF ITS FIRST COUNT AND WHOSE DECISION FOLLOWS FROM THE RUN-OFF: '
            + 'a choice, a second split, a run-off that missed its quorum, a tie of two leaders, and an earlier run\'s split '
            + 'recorded with no run-off',
          fn: async () => {
            const { runOff: _runOff, ...earlier } = RUN_OFF_CARRY;
            const carries: readonly ArtifactConsistencyCarry[] = [
              RUN_OFF_CARRY,
              {
                ...RUN_OFF_CARRY,
                runOff: {
                  ...RUN_OFF,
                  ballots: [
                    ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 1', },),
                    ballotOf({ seat: 'bedrock-cat', choice: 'CANDIDATE 2', },),
                    ballotOf({ seat: 'vision-cat', choice: 'CANDIDATE 3', },),
                  ],
                },
                decision: { kind: 'none', reason: 'no-majority', },
              },
              {
                ...RUN_OFF_CARRY,
                runOff: {
                  ...RUN_OFF,
                  ballots: [ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 3', },),],
                  usable: 1,
                },
                decision: { kind: 'none', reason: 'no-quorum', },
              },
              {
                ...RUN_OFF_CARRY,
                ballots: [
                  ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 1', },),
                  ballotOf({ seat: 'bedrock-cat', choice: 'CANDIDATE 3', },),
                ],
                usable: 2,
                runOff: {
                  finalists: ['CANDIDATE 1', 'CANDIDATE 3',],
                  ballots: [
                    ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 1', },),
                    ballotOf({ seat: 'bedrock-cat', choice: 'CANDIDATE 1', },),
                  ],
                  usable: 2,
                  quorum: 2,
                },
                decision: { kind: 'chosen', label: 'CANDIDATE 1', },
              },
              { ...earlier, decision: { kind: 'none', reason: 'no-majority', }, },
            ];
            // Each carry is read without a refusal: the recount returns for every one.
            for (const carry of carries) {
              expect(assertCarriesRecount({ carries: [carry,], path: 'cat.carries', },),).toBeUndefined();
            }
          },
        },),
        it({
          name: 'REFUSES A RUN-OFF THAT DOES NOT FOLLOW FROM THE FIRST COUNT: finalists that are not the tied leaders, a run-off '
            + 'beside a strict majority, and one beside a first count that missed its quorum',
          fn: async () => {
            const wrongFinalists = recountRefusalOf({
              carry: { ...RUN_OFF_CARRY, runOff: { ...RUN_OFF, finalists: ['CANDIDATE 1', 'CANDIDATE 3',], }, },
            },);
            const besideMajority = recountRefusalOf({
              carry: {
                ...RUN_OFF_CARRY,
                ballots: [
                  ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 3', },),
                  ballotOf({ seat: 'bedrock-cat', choice: 'CANDIDATE 3', },),
                  ballotOf({ seat: 'vision-cat', choice: 'CANDIDATE 2', },),
                ],
              },
            },);
            const besideNoQuorum = recountRefusalOf({
              carry: { ...RUN_OFF_CARRY, ballots: [ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 1', },),], usable: 1, },
            },);
            expect([
              wrongFinalists.includes('cat.carries[0].runOff.finalists',),
              besideMajority.includes('cat.carries[0].runOff',),
              besideNoQuorum.includes('cat.carries[0].runOff',),
            ],).toEqual([true, true, true,],);
          },
        },),
        it({
          name: 'REFUSES A COUNT OR A DECISION THAT DOES NOT FOLLOW FROM THE RUN-OFF\'S OWN CHOICES: a usable count that is not '
            + 'the choices of the finalists, a decision that is not what they give, and a seat heard twice',
          fn: async () => {
            const wrongUsable = recountRefusalOf({
              carry: { ...RUN_OFF_CARRY, runOff: { ...RUN_OFF, usable: 2, }, },
            },);
            const wrongDecision = recountRefusalOf({
              carry: { ...RUN_OFF_CARRY, decision: { kind: 'chosen', label: 'CANDIDATE 2', }, },
            },);
            const twiceHeard = recountRefusalOf({
              carry: {
                ...RUN_OFF_CARRY,
                runOff: {
                  ...RUN_OFF,
                  ballots: [
                    ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 3', },),
                    ballotOf({ seat: 'hyper-cat', choice: 'CANDIDATE 3', },),
                  ],
                  usable: 2,
                },
              },
            },);
            expect([
              wrongUsable.includes('cat.carries[0].runOff.usable',),
              wrongDecision.includes('cat.carries[0].decision',),
              twiceHeard.includes('cat.carries[0].runOff.ballots',),
            ],).toEqual([true, true, true,],);
          },
        },),
      ],
    },),
  ],
},);
