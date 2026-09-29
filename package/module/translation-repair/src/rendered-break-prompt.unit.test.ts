/**
 Verifies that rendered structure reaches production sheets before models write
 or choose text. Live probes, not these assertions, measure model behavior.
 
 @module
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
        const lane = buildLaneContestMessages({ subject: { lineStructured: false, sourceText: SOURCE, incumbentText: '', repairText: FLAT, translateText: KEPT, }, },);
        /** The final gate cannot prefer a flat polish for wording alone. */
        const gate = buildConsolidateGateMessages({ subject: { lineStructured: false, sourceText: SOURCE, incumbentText: '', standingText: KEPT, consolidatedText: FLAT, }, },);
        expect(JSON.stringify(lane,),).toContain(CONTRACT,);
        expect(JSON.stringify(gate,),).toContain(CONTRACT,);
        expect(JSON.stringify(lane,),).toContain('CANDIDATE',);
      },
    },),
    // LEDGER B29: the consolidation writer is shown both lanes' candidates,
    // and its sheet left their counts out while the gates after it carry
    // theirs, so a candidate that flattened the original's lines looked no
    // different to the writer building on it.
    it({
      name: 'SHOWS the consolidation writer the counts of the candidates its sheet displays',
      fn: async () => {
        /** Both lanes answered, neither with the archive's wording. */
        const [system,] = buildConsolidateMessages({
          subject: { sourceText: SOURCE, incumbentText: '', repairText: FLAT, translateText: KEPT, ballots: [], lineStructured: false, },
        },);
        expect(system?.content,).toContain(`${JSON.stringify('CANDIDATE "repair"',)} explicit breaks by top-level block: [0]`,);
        expect(system?.content,).toContain(`${JSON.stringify('CANDIDATE "translate"',)} explicit breaks by top-level block: [1]`,);
      },
    },),
    it({
      name: 'COUNTS no candidate the consolidation sheet leaves undisplayed',
      fn: async () => {
        /** The repair lane has no wording here, so the sheet shows no block for it. */
        const [system,] = buildConsolidateMessages({
          subject: { sourceText: SOURCE, incumbentText: '', repairText: '', translateText: KEPT, ballots: [], lineStructured: false, },
        },);
        expect(system?.content,).toContain(`${JSON.stringify('CANDIDATE "translate"',)} explicit breaks by top-level block: [1]`,);
        expect(system?.content,).not
          .toContain(`${JSON.stringify('CANDIDATE "repair"',)} explicit breaks`,);
      },
    },),
    // LEDGER B29: the follow-up writer is shown the candidates the judges
    // declined, and its sheet left their counts out while the judges had them.
    it({
      name: 'SHOWS the follow-up writer the counts of the rejected candidates its sheet displays',
      fn: async () => {
        /** One flattened and one kept rendering, both declined. */
        const [system,] = buildTranslateMessages({
          sourceText: SOURCE,
          existingText: '',
          followupEvidence: { reason: 'declined-rejection', candidateTexts: [FLAT, KEPT,], findings: [], },
        },).messages;
        expect(system?.content,).toContain(`${JSON.stringify('REJECTED CANDIDATE 1',)} explicit breaks by top-level block: [0]`,);
        expect(system?.content,).toContain(`${JSON.stringify('REJECTED CANDIDATE 2',)} explicit breaks by top-level block: [1]`,);
      },
    },),
  ],
},);
