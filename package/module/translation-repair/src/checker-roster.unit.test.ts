/**
 * Tests for what a checker roster may look like: when a checker is allowed to
 * have written the text it grades, and how small the roster may get.
 *
 * TWO REFUSALS BEHAVE DIFFERENTLY AND THE DIFFERENCE IS THE POINT. Overlap is a
 * question about evidence quality, and `tallyResolutionChecks` can answer it by
 * halving a self-vote per issue, so the owner's ruling of 2026-08-23 sent it to
 * measurement behind a switch. A repeated id and a roster too small to decide
 * are not that kind of question: the first makes the quorum count disagree with
 * the ballot count, and the second makes disagreement return nothing at all.
 * Neither is rescued by any weighting, so neither honours the switch.
 *
 * Model ids come from the catalog because `RosterModelId` is a closed union.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  assertCheckerIndependence,
  assertCheckerQuorumReachable,
  CheckerIndependenceError,
  CheckerQuorumError,
  type RosterModelId,
} from '../dist/final/node/index.mjs';

/**
 * Writers as production seats them: three models that edit and refine.
 */
const WRITERS: readonly RosterModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
];

/**
 * Checkers as production seats them, disjoint from every writer.
 */
const DISJOINT_CHECKERS: readonly RosterModelId[] = [
  'hf:Qwen/Qwen3.8-27B',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Whole roster checking, which is the arm the measurement exists to price.
 */
const EVERY_MODEL: readonly RosterModelId[] = [
  ...WRITERS,
  ...DISJOINT_CHECKERS,
];

await describe({
  name: assertCheckerIndependence.name,
  children: [
    it({
      name: 'REFUSES a checker that also writes when nothing permits it, which is the default and '
        + 'stays the default: an unset switch must not read as permission',
      fn: async () => {
        expect(function checksOwnWork() {
          assertCheckerIndependence({
            editorModelIds: WRITERS,
            checkerModelIds: EVERY_MODEL,
          },);
        },).toThrow(CheckerIndependenceError,);

        expect(function permissionOff() {
          assertCheckerIndependence({
            editorModelIds: WRITERS,
            checkerModelIds: EVERY_MODEL,
            selfCertificationPermitted: false,
          },);
        },).toThrow(CheckerIndependenceError,);
      },
    },),

    it({
      name: 'ACCEPTS the whole roster checking when self-certification is permitted, since the '
        + 'weight of a checker on text it wrote is chosen per issue rather than the seat being '
        + 'refused outright',
      fn: async () => {
        assertCheckerIndependence({
          editorModelIds: WRITERS,
          refinerModelIds: WRITERS,
          checkerModelIds: EVERY_MODEL,
          selfCertificationPermitted: true,
        },);
      },
    },),

    it({
      name: 'REFUSES a REPEATED checker id even with self-certification permitted, because a repeat '
        + 'is a different fault: it meets quorum on fewer independent voices than the roster size '
        + 'promises, and no per-issue weighting can undo that',
      fn: async () => {
        expect(function repeatsAVoice() {
          assertCheckerIndependence({
            editorModelIds: WRITERS,
            checkerModelIds: [
              ...DISJOINT_CHECKERS,
              'hf:Qwen/Qwen3.8-27B',
            ],
            selfCertificationPermitted: true,
          },);
        },).toThrow(CheckerIndependenceError,);
      },
    },),

    it({
      name: 'REFUSES a REFINER among the checkers as readily as an editor, because the recheck that '
        + 'follows a refinement asks whether the accepted issues survived it',
      fn: async () => {
        expect(function refinerChecks() {
          assertCheckerIndependence({
            editorModelIds: ['hf:moonshotai/Kimi-K3',],
            refinerModelIds: ['hf:zai-org/GLM-5.2',],
            checkerModelIds: [
              'hf:zai-org/GLM-5.2',
              'hf:Qwen/Qwen3.8-27B',
              'hf:openai/gpt-oss-120b',
            ],
          },);
        },).toThrow(CheckerIndependenceError,);
      },
    },),

    it({
      name: 'ACCEPTS production’s disjoint rosters unchanged, so the switch landing changes '
        + 'nothing about the arm that ships today',
      fn: async () => {
        assertCheckerIndependence({
          editorModelIds: WRITERS,
          refinerModelIds: WRITERS,
          checkerModelIds: DISJOINT_CHECKERS,
        },);
      },
    },),
  ],
},);

await describe({
  name: assertCheckerQuorumReachable.name,
  children: [
    it({
      name: 'ACCEPTS three checkers, which is where a two-to-one reading still resolves',
      fn: async () => {
        assertCheckerQuorumReachable({ checkerModelIds: DISJOINT_CHECKERS, },);
        assertCheckerQuorumReachable({ checkerModelIds: EVERY_MODEL, },);
      },
    },),

    it({
      name: 'REFUSES two checkers, which is exactly what widening the producing roles to four would '
        + 'have left behind: one fixed against one not-fixed decides nothing, so checking would run '
        + 'and return no verdict',
      fn: async () => {
        expect(function cannotDecide() {
          assertCheckerQuorumReachable({ checkerModelIds: [
            'hf:Qwen/Qwen3.8-27B',
            'hf:openai/gpt-oss-120b',
          ], },);
        },).toThrow(CheckerQuorumError,);
      },
    },),

    it({
      name: 'REFUSES one checker and an empty roster, so the floor covers the case the empty-role '
        + 'guard already caught as well as the ones it never did',
      fn: async () => {
        expect(function onlyOne() {
          assertCheckerQuorumReachable({ checkerModelIds: ['hf:Qwen/Qwen3.8-27B',], },);
        },).toThrow(CheckerQuorumError,);
        expect(function nobody() {
          assertCheckerQuorumReachable({ checkerModelIds: [], },);
        },).toThrow(CheckerQuorumError,);
      },
    },),

    it({
      name: 'REFUSES a roster of two that is ALSO permitted to self-certify, since the floor and '
        + 'the switch answer different questions and permission to overlap is not permission to '
        + 'shrink below a decidable panel',
      fn: async () => {
        /** Two writers checking their own work, which passes independence under the switch. */
        const twoWriters: readonly RosterModelId[] = [
          'hf:moonshotai/Kimi-K3',
          'hf:zai-org/GLM-5.2',
        ];
        assertCheckerIndependence({
          editorModelIds: WRITERS,
          checkerModelIds: twoWriters,
          selfCertificationPermitted: true,
        },);
        expect(function stillTooFew() {
          assertCheckerQuorumReachable({ checkerModelIds: twoWriters, },);
        },).toThrow(CheckerQuorumError,);
      },
    },),
  ],
},);
