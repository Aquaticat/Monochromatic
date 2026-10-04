/**
 Tests that the coverage control counts a case ONLY WHEN THE VOTE MOVED.

 WHAT THE CONTROL IS FOR. It exists to answer one question: can this wire vote
 absence at all? A roster that answers `full` to the undamaged passage and
 `full` again once the rendering it pointed at has been deleted has shown
 exactly nothing, and that is the reading the whole gate was built to refuse.

 WHAT WAS MEASURED. On 2026-08-25, relaxing the comparison that counts a case
 from `absentAfter > absentBefore` to `absentAfter >= absentBefore` failed no
 test in this package. Under that relaxation every damaged case counts as a
 case where the wire noticed, including one whose votes never moved, so a wire
 that cannot see damage reports a HELD control and licenses the null it was
 supposed to invalidate.

 COUNTED ON VOTES, NOT ON THE VERDICT KIND, which is what the field's own
 documentation says: the recorded null is about ballots rather than about how
 they were rolled up.

 NO NETWORK. One scripted answer serves every round: full coverage, quoting a
 sentence really present, so the standing verdict carries, its evidence can be
 located and cut, and the answer after the cut is identical to the answer
 before it. That is a wire blind to damage, spelled out.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  coverageControlHolds,
  type ChatJsonRequest,
  messageText,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';
import {
  coverageControlCasesAt,
  coverageControlClient,
} from './coverage-control-cases.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '../roster-seats.test-fixture.ts';

/**
 Logger for the control under test.
 */
const l = tagged({ tag: 'coverage-control-vote-change-test', },);

//region Fixtures

/**
 Sentence every scripted judge quotes, verbatim from `TRANSLATION`, so
 the standing verdict carries and its evidence can be located and cut.
 */
const QUOTED = 'Whiskers counts the birds outside.';

/**
 Translation the cases ask about, long enough on both sides of the quoted
 sentence that an equally large decoy cut has somewhere to go.
 */
const TRANSLATION = `The kitten dozes on the windowsill in the afternoon sun. ${QUOTED} `
  + 'The tabby sleeps by the radiator until evening.';

/**
 Original passage the cases ask about.
 */
const SOURCE_PASSAGE = '白胡子数着外面的鸟。';

/**
 Roster asked at every round.
 */
const MODEL_IDS = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
] as const;

/**
 Three damageable cases, distinguished only by where they sit.
 */
const CASES = coverageControlCasesAt({
  where: ['slice-0', 'slice-1', 'slice-2',],
  sourcePassage: SOURCE_PASSAGE,
  translationText: TRANSLATION,
},);

/**
 Client answering EVERY round the same way, damaged or not: a wire whose votes
 do not move is the one the control has to refuse.
 */
const BLIND_CLIENT = coverageControlClient({ quote: QUOTED, },);

//endregion Fixtures

await describe({
  name: coverageControlHolds.name,
  children: [
    it({
      name: 'REFUSES to hold when deleting the rendering changed no vote, which is the reading the '
        + 'gate exists to invalidate: a wire answering the same way to the damaged page as to the '
        + 'undamaged one has shown the absence vote unreachable, not the passage covered',
      fn: async () => {
        /**
         What the control made of a roster whose votes never move.
         */
        const control = await coverageControlHolds({
          client: BLIND_CLIENT,
          cases: CASES,
          modelIds: [...MODEL_IDS,],
          signal: AbortSignal.timeout(120_000,),
          exchangeTimeoutMs: 30_000,
          l,
        },);

        // Every case was damageable, so all three reached the after round and
        // the length of `control.rows` is taken over three rows rather than
        // over none.
        expect(control.rows,).toHaveLength(3,);
        expect(control.refusals,).toStrictEqual([],);

        // The vote is identical before and after. Nothing moved, so nothing was
        // noticed, and a count of three here would mean the control credits a
        // wire for answering at all rather than for answering differently.
        expect(control.sawAbsenceOnTarget,).toBe(0,);
        expect(control.held,).toBe(false,);
      },
    },),

    it({
      name: 'RECORDS A REFUSAL for a case whose undamaged verdict never claimed the passage is '
        + 'carried, since only a carried case can have its rendering deleted',
      fn: async () => {
        /**
         Client answering that the passage is not carried at all.
         */
        const denying: SyntheticClient = {
          chatText: async () => {
            throw new Error('chatText unused by the coverage control',);
          },
          chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,) => {
            /**
             Reply claiming the passage is absent.
             */
            const scripted: unknown = {
              coverage: 'none',
              quote: '',
              reason: 'fixture',
            };
            if (!request.validate(scripted,))
              return {
                kind: 'schema-mismatch',
                rawText: '',
                detail: 'fixture',
              };
            return {
              kind: 'ok',
              value: scripted as ValueT,
              rawText: JSON.stringify(scripted,),
            };
          },
          quotas: async () => {
            throw new Error('quotas unused by the coverage control',);
          },
        };
        const control = await coverageControlHolds({
          client: denying,
          cases: CASES,
          modelIds: [...MODEL_IDS,],
          signal: AbortSignal.timeout(120_000,),
          exchangeTimeoutMs: 30_000,
          l,
        },);
        expect(control.rows,).toHaveLength(0,);
        expect(control.refusals.length,).toBeGreaterThan(0,);
        expect(control.refusals[0]?.reason,).toBe('not-carried',);
      },
    },),

    it({
      name: 'RECORDS A REFUSAL when the evidence cut empties the translation, since nothing is left '
        + 'to ask the roster about',
      fn: async () => {
        /**
         Cases whose anchored span is the whole translation.
         */
        const whole = coverageControlCasesAt({
          where: ['envelope/whole',],
          sourcePassage: SOURCE_PASSAGE,
          translationText: TRANSLATION,
        },);
        const control = await coverageControlHolds({
          client: coverageControlClient({ quote: TRANSLATION, },),
          cases: whole,
          modelIds: [...MODEL_IDS,],
          signal: AbortSignal.timeout(120_000,),
          exchangeTimeoutMs: 30_000,
          l,
        },);
        expect(control.rows,).toHaveLength(0,);
        expect(control.refusals[0]?.reason,).toBe('evidence-not-locatable',);
      },
    },),

    it({
      name: 'RECORDS A REFUSAL when no window clear of the anchored span can take a decoy cut of the '
        + 'same size',
      fn: async () => {
        /**
         Quoted rendering filling all but one character of the translation.
         */
        const tight = `${QUOTED} x`;
        const control = await coverageControlHolds({
          client: coverageControlClient({ quote: QUOTED, },),
          cases: coverageControlCasesAt({
            where: ['envelope/tight',],
            sourcePassage: SOURCE_PASSAGE,
            translationText: tight,
          },),
          modelIds: [...MODEL_IDS,],
          signal: AbortSignal.timeout(120_000,),
          exchangeTimeoutMs: 30_000,
          l,
        },);
        expect(control.rows,).toHaveLength(1,);
        expect(control.refusals,).toHaveLength(0,);
        expect(JSON.stringify(control.rows[0],).includes('no-room',),).toBe(true,);
      },
    },),

    it({
      name: 'HOLDS when the absence vote moves with the targeted cut and never with the decoy one',
      fn: async () => {
        /**
         Client whose vote follows the quoted rendering on the sheet.
         */
        const moving: SyntheticClient = {
          chatText: async () => {
            throw new Error('chatText unused by the coverage control',);
          },
          chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,) => {
            /**
             Sheet as one text, where the rendering rides or does not.
             */
            const sheet = request.messages
              .map(function toContent(message,) {
                return messageText({ message, },);
              },)
              .join('\n',);
            /**
             Reply claiming what the sheet shows: coverage with the quote,
             and none with an empty one, the two never contradicting.
             */
            const carries = sheet.includes(QUOTED,);
            const scripted: unknown = {
              coverage: carries ? 'full' : 'none',
              quote: carries ? QUOTED : '',
              reason: 'fixture',
            };
            if (!request.validate(scripted,))
              return {
                kind: 'schema-mismatch',
                rawText: '',
                detail: 'fixture',
              };
            return {
              kind: 'ok',
              value: scripted as ValueT,
              rawText: JSON.stringify(scripted,),
            };
          },
          quotas: async () => {
            throw new Error('quotas unused by the coverage control',);
          },
        };
        const control = await coverageControlHolds({
          client: moving,
          cases: CASES,
          modelIds: [...MODEL_IDS,],
          signal: AbortSignal.timeout(120_000,),
          exchangeTimeoutMs: 30_000,
          l,
        },);
        expect(control.rows.length,).toBeGreaterThan(0,);
        expect(control.sawAbsenceOnTarget,).toBeGreaterThan(0,);
        expect(control.sawAbsenceOnDecoy,).toBe(0,);
        expect(control.held,).toBe(true,);
      },
    },),
  ],
},);
