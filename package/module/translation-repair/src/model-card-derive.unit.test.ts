/**
 Tests reading a roster model's decisions side (ledger T8): a decision seat
 hands back the side its card carries, and a chat seat, whose card carries
 none, is refused by name rather than read as undefined. The seats are drawn
 from the roster itself, so the case follows the roster as it changes.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DecisionsCardMissingError,
  decisionsCardOf,
  isDecisionSeat,
  recordOver,
  MODEL_CARDS,
  ROSTER_MODEL_IDS,
} from '../dist/final/node/index.mjs';

await describe({
  name: decisionsCardOf.name,
  children: [
    it({
      name: 'HANDS BACK A DECISION SEAT\'S SIDE, and refuses a chat seat, whose card carries none',
      fn: async () => {
        const decisionSeat = ROSTER_MODEL_IDS.find((modelId,) => isDecisionSeat({ modelId, },));
        const chatSeat = ROSTER_MODEL_IDS.find((modelId,) => !isDecisionSeat({ modelId, },));
        if ((decisionSeat === undefined) || (chatSeat === undefined))
          throw new Error('the roster needs a decision seat and a chat seat for this case',);
        expect(decisionsCardOf({ modelId: decisionSeat, },),).toBe(MODEL_CARDS[decisionSeat].decisions,);
        expect(() => decisionsCardOf({ modelId: chatSeat, },),).toThrow(DecisionsCardMissingError,);
      },
    },),

    it({
      name: 'REFUSES keys that repeat, since one record cannot hold one key twice, and BUILDS the record '
        + 'where they do not',
      fn: async () => {
        expect(recordOver({
          keys: ['cat', 'dog',],
          of: function weight(): number {
            return 1;
          },
        },),).toEqual({ cat: 1, dog: 1, },);
        expect(function repeats(): void {
          recordOver({
            keys: ['cat', 'cat',],
            of: function weight(): number {
              return 1;
            },
          },);
        },).toThrow(RangeError,);
      },
    },),
  ],
},);
