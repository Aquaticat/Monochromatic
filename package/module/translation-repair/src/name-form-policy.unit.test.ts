/**
 * Verifies measured quoted-form scope reaches writers, critics and selectors.
 * Live evidence chooses the remedy; these checks only lock down its integration.
 *
 * @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  buildConsolidateMessages,
  buildCriticMessages,
  buildEditorMessages,
  buildLaneContestMessages,
  buildTranslateMessages,
  messageText,
  translateSelectionCriteria,
} from '../dist/final/node/index.mjs';

/** Invented character/name contrast, not a quotation to copy untranslated. */
const SOURCE = '> 林？不是，我叫 Lin。';
/** Archive keeps the spelling being discussed rather than normalizing it. */
const ARCHIVE = '> “林”? No, I go by Lin.';
/** Declared identity applies to references, not the denied character form. */
const IDENTITY = '- name: ORIGINAL declares "Lin", TRANSLATION declares "Lin"';
/** Shared rule's specific scope, rather than a general fidelity promise. */
const SCOPE = 'retain the form under discussion';

/**
 * Reads system instructions without confusing them with source examples.
 *
 * @param messages - production builder output
 *
 * @returns Instruction text only
 */
function systemText(messages: ReturnType<typeof buildCriticMessages>,): string {
  return messages.filter(function system(message,) {
    return message.role === 'system';
  },).map(function text(message,) {
    return messageText({ message, },);
  },).join('\n',);
}

/** Real sheets for independently owned writing and judging paths. */
const sheets = [
  {
    name: 'initial translator',
    text: systemText(buildTranslateMessages({ sourceText: SOURCE, existingText: ARCHIVE, identityContext: IDENTITY, },).messages,),
  },
  {
    name: 'repair editor',
    text: systemText(buildEditorMessages({ sourceText: SOURCE, targetText: ARCHIVE, envelopes: [], issues: [], },).messages,),
  },
  {
    name: 'consolidation writer',
    text: systemText(buildConsolidateMessages({ subject: { sourceText: SOURCE, incumbentText: ARCHIVE, repairText: ARCHIVE, translateText: ARCHIVE, ballots: [], lineStructured: false, identityContext: IDENTITY, }, },),),
  },
  {
    name: 'critic',
    text: systemText(buildCriticMessages({ sourceText: SOURCE, targetText: ARCHIVE, identityContext: IDENTITY, },),),
  },
  {
    name: 'lane contest',
    text: systemText(buildLaneContestMessages({ subject: { sourceText: SOURCE, incumbentText: ARCHIVE, repairText: ARCHIVE, translateText: ARCHIVE, identityContext: IDENTITY, }, },),),
  },
];

await describe({
  name: 'name reference and mentioned-form policy',
  children: [
    ...sheets.map(function scopeReached(sheet,) {
      return it({
        name: `SCOPES name normalization in ${sheet.name}`,
        fn: async () => {
          expect(sheet.text,).toContain(SCOPE,);
          expect(sheet.text,).toContain('does not license leaving an entire source-language quotation untranslated',);
        },
      },);
    },),
    it({
      name: 'QUALIFIES the actual faithfulness and name criteria rather than appending a competing rule',
      fn: async () => {
        const criteria = translateSelectionCriteria({ lineStructured: false, },);
        expect(criteria[1],).toContain('TO REFER TO a person',);
        expect(criteria[1],).toContain('forms being questioned, contrasted, or denied',);
        expect(criteria[2],).toContain(SCOPE,);
        expect(criteria[2],).toContain('A declared identity is not extra content',);
      },
    },),
    it({
      name: 'LEAVES dedicated metadata criteria outside the prose-name exception',
      fn: async () => {
        const criteria = translateSelectionCriteria({ lineStructured: false, syntax: 'front-matter', },);
        expect(criteria.join('\n',),).not.toContain(SCOPE,);
        expect(criteria.join('\n',),).toContain('Source authority',);
      },
    },),
  ],
},);
