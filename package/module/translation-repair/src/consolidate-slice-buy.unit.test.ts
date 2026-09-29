/**
 Tests for when a single consolidation attempt ships a standing the lane
 contest never endorsed, with the non-endorsement recorded.

 The provider-identity anonymizer these cases once shared a file with built
 evidence for a stage-local recovery the single attempt ended (1ba8f713a);
 nothing called it, and it went on 2026-09-29 (ledger B30).

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ConsolidationSettlement,
  standingKeptUnendorsed,
} from '../dist/final/node/index.mjs';

/**
 A settlement ending in one terminal, the only field the rule reads.

 @param terminal - how the attempt ended

 @returns Settlement cast past the fields the rule never reads
 */
function settlementEnding(
  { terminal, }: { readonly terminal: ConsolidationSettlement['terminal']; },
): ConsolidationSettlement {
  return {
    terminal,
    text: 'The cat sleeps.',
    findings: [],
  } as unknown as ConsolidationSettlement;
}

await describe({
  name: standingKeptUnendorsed.name,
  children: [
    it({
      name: 'NAMES an unendorsed standing the attempt kept, and neither an endorsed one nor a consolidated '
        + 'settlement',
      fn: async () => {
        expect(standingKeptUnendorsed({
          settlement: settlementEnding({ terminal: 'gate-kept-standing', },),
          standingMayShip: false,
        },),).toBe(true,);
        expect(standingKeptUnendorsed({
          settlement: settlementEnding({ terminal: 'gate-kept-standing', },),
          standingMayShip: true,
        },),).toBe(false,);
        expect(standingKeptUnendorsed({
          settlement: settlementEnding({ terminal: 'consolidated', },),
          standingMayShip: false,
        },),).toBe(false,);
      },
    },),
  ],
},);
