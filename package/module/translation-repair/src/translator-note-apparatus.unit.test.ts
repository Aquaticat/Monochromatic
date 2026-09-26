/**
 Guards class one hundred forty-three (hulicaijia26, 2026-09-26). The
 archive's footnote 7 carried the translator's note explaining the wordplay
 between 晚安 (goodnight) and 金刚烷胺 (amantadine), which the English cannot
 carry by itself. deepseek-v4.1-flash filed it as accuracy/addition, the panel
 accepted it (minimax-m3 and gemma-4-26b-a4b-it for, Mercury 2.5 against), the
 acceptance disputed the archive under class one hundred seven, and four of
 five contest judges called the note "an addition the ORIGINAL never states".
 The critic and the panel sheets named citations, credits and identifying
 glosses as accurate translator detail, but no sheet named a note explaining
 wordplay, and the page-apparatus clause the writers and the contest read was
 on neither sheet that files and accepts the claim.

 The same clause said "only what the ORIGINAL contradicts is an addition",
 which is the wording a class one hundred eight gate ballot used to keep an
 invented overdose detail ("which the Chinese does not contradict"). The
 apparatus is what explains the text; what happened is never apparatus.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildAdjudicationMessages,
  buildCriticMessages,
  CONTEST_POLICY,
  PAGE_APPARATUS_IS_KEPT,
} from '../dist/final/node/index.mjs';

/**
 Wording naming a translator's note that explains wordplay as apparatus.
 */
const WORDPLAY_NOTE = 'a translator\'s note explaining a pun, wordplay, an allusion or a term';

/**
 Wording saying narrative detail is an addition however uncontradicted.
 */
const NARRATIVE_DETAIL = 'WHAT HAPPENED IS NEVER APPARATUS';

/**
 Critic system instructions for a cat-themed pair.
 */
const critic = buildCriticMessages({
  sourceText: '猫说晚安。',
  targetText: 'The cat said goodnight.',
},)
  .filter(function isSystem(message,): boolean {
    return message.role === 'system';
  },)
  .map(function toContent(message,): string {
    return message.content;
  },)
  .join('\n',);

/**
 Panelist system instructions for a cat-themed pair with no claims.
 */
const panel = buildAdjudicationMessages({
  sourceText: '猫说晚安。',
  targetText: 'The cat said goodnight.',
  clusters: [],
},)
  .messages[0]
  ?.content ?? '';

await describe({
  name: 'translator note is apparatus (class one hundred forty-three)',
  children: [
    it({
      name: 'NAMES a translator note explaining wordplay as apparatus on the critic sheet, which filed it as an addition',
      fn: async () => {
        expect(critic,).toContain(WORDPLAY_NOTE,);
      },
    },),
    it({
      name: 'NAMES it on the adjudication panel sheet, which accepted the claim 2 to 1',
      fn: async () => {
        expect(panel,).toContain(WORDPLAY_NOTE,);
      },
    },),
    it({
      name: 'NAMES it in the contest policy, where four of five ballots called the note an addition',
      fn: async () => {
        expect(CONTEST_POLICY,).toContain(WORDPLAY_NOTE,);
      },
    },),
    it({
      name: 'NAMES it in the page-apparatus clause every writer and slate judge reads',
      fn: async () => {
        expect(PAGE_APPARATUS_IS_KEPT,).toContain(WORDPLAY_NOTE,);
      },
    },),
    it({
      name: 'SAYS what happened is never apparatus wherever an uncontradicted detail was exempt (class one hundred '
        + 'eight\'s gate kept an invented overdose detail "which the Chinese does not contradict")',
      fn: async () => {
        expect(PAGE_APPARATUS_IS_KEPT,).toContain(NARRATIVE_DETAIL,);
        expect(CONTEST_POLICY,).toContain(NARRATIVE_DETAIL,);
        expect(PAGE_APPARATUS_IS_KEPT.includes('Only what the ORIGINAL contradicts is an addition.',),).toBe(false,);
      },
    },),
  ],
},);
