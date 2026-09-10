/**
 * Verifies that rendered structure reaches production sheets before models write
 * or choose text. Live probes, not these assertions, measure model behavior.
 *
 * @module
 */

import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  buildConsolidateGateMessages,
  buildConsolidateMessages,
  buildLaneContestMessages,
  buildTranslateMessages,
  buildTranslateRepairMessages,
} from '../dist/final/node/index.mjs';

/** Explicit structure inside one block, not blank-separated verse. */
const SOURCE = '> 猫醒了。  \n> 鸟唱了。';
/** A physically multiline candidate that would render flat. */
const FLAT = '> The cat wakes.\n> The bird sings.';
/** Equivalent English with an unambiguous visible break spelling. */
const KEPT = '> The cat wakes.<br/>The bird sings.';
/** Shared heading must identify the same contract to every role. */
const CONTRACT = 'RENDERED LINE STRUCTURE';

await describe({
  name: 'rendered line structure reaches production sheets',
  children: [
    it({
      name: 'TELLS the initial writer about rendered breaks despite a false verse heuristic',
      fn: async () => {
        /** Use the actual initial writer builder, before any repair findings. */
        const plan = buildTranslateMessages({ sourceText: SOURCE, existingText: '', lineStructured: false, },);
        expect(JSON.stringify(plan.messages,),).toContain(CONTRACT,);
        expect(JSON.stringify(plan.messages,),).toContain('soft newlines',);
        expect(JSON.stringify(plan.messages,),).toContain('<br/>',);
        /** Verbatim source must remain evidence, not be canonicalized in place. */
        expect(JSON.stringify(plan.messages,),).toContain(JSON.stringify(SOURCE,).slice(1, -1,),);
      },
    },),
    it({
      name: 'CARRIES the same contract into author repair without rewriting source evidence',
      fn: async () => {
        /** Repair keeps the initial role and source messages. */
        const prior = buildTranslateMessages({ sourceText: SOURCE, existingText: '', },);
        /** This is the actual author-defense/revision conversation builder. */
        const messages = buildTranslateRepairMessages({ priorMessages: prior.messages, priorTranslation: FLAT, findings: ['Preserve the rendered line break.'], },);
        expect(JSON.stringify(messages,),).toContain(CONTRACT,);
      },
    },),
    it({
      name: 'TELLS consolidation writers the same rendered requirement before producing proposals',
      fn: async () => {
        /** Both lineages exist, but neither is an archival rendering. */
        const messages = buildConsolidateMessages({
          subject: { sourceText: SOURCE, incumbentText: '', repairText: '', translateText: KEPT, ballots: [], lineStructured: false, },
        },);
        expect(JSON.stringify(messages,),).toContain(CONTRACT,);
      },
    },),
    it({
      name: 'SHOWS named candidate counts to lane and consolidation gates',
      fn: async () => {
        /** The lane gate must distinguish physical and rendered lines. */
        const lane = buildLaneContestMessages({ subject: { sourceText: SOURCE, incumbentText: '', repairText: FLAT, translateText: KEPT, }, },);
        /** The final gate cannot prefer a flat polish for wording alone. */
        const gate = buildConsolidateGateMessages({ subject: { sourceText: SOURCE, incumbentText: '', standingText: KEPT, consolidatedText: FLAT, }, },);
        expect(JSON.stringify(lane,),).toContain(CONTRACT,);
        expect(JSON.stringify(gate,),).toContain(CONTRACT,);
        expect(JSON.stringify(lane,),).toContain('CANDIDATE',);
      },
    },),
  ],
},);
