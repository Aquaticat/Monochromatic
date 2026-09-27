/**
 Guards ledger S5: every sheet that files, votes on or keeps page apparatus
 reads one list of its kinds.

 Before the shared list, the critic named citations, credits, identifying
 glosses and translator notes; the panel named the same four; the contest named
 a name, a spelled-out referent, a gloss and a translator note; the writers'
 clause named glosses, notes, asides, referents, credits and a citation's
 translator; the archive block review named a credit and a citation. A kind
 missing from one list read to that sheet as an addition, so an explanatory
 aside the writers kept was a defect to the critic, and a spelled-out referent
 the contest kept was an addition to the panel.

 The critic and panel sheets also licensed accurate added detail without the
 narrative bound the contest and the writers carried, so an invented event
 could pass there as "accurate detail a translator added".

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  APPARATUS_KINDS,
  buildAdjudicationMessages,
  buildArchiveBlockReviewMessages,
  buildCriticMessages,
  CONTEST_POLICY,
  NARRATIVE_DETAIL_IS_NOT_APPARATUS,
  PAGE_APPARATUS_IS_KEPT,
} from '../dist/final/node/index.mjs';

/**
 Joins every system message, since each sheet's rules live there.

 @param messages - Chat messages one builder returned.
 @returns System text a model reads before the pair.
 */
function systemText(messages: readonly { readonly role: string; readonly content: string; }[],): string {
  return messages
    .filter(function isSystem(message,): boolean {
      return message.role === 'system';
    },)
    .map(function toContent(message,): string {
      return message.content;
    },)
    .join('\n',);
}

/**
 Critic system instructions for a cat-themed pair.
 */
const critic = systemText(buildCriticMessages({
  sourceText: '猫睡了。',
  targetText: 'The cat slept.',
},),);

/**
 Panelist system instructions for a cat-themed pair with no claims.
 */
const panel = systemText(buildAdjudicationMessages({
  sourceText: '猫睡了。',
  targetText: 'The cat slept.',
  clusters: [],
},).messages,);

/**
 Archive block review system instructions for a cat-themed credit block.
 */
const blockReview = systemText(buildArchiveBlockReviewMessages({
  sourceText: '猫睡了。',
  targetText: 'The cat slept.\n\nTranslated by a tabby.',
  blockText: 'Translated by a tabby.',
  priorFindings: [],
},),);

await describe({
  name: 'apparatus kinds are one list (ledger S5)',
  children: [
    it({
      name: 'LISTS the union of every kind any sheet named, so no sheet reads a kept kind as an addition',
      fn: async () => {
        expect(APPARATUS_KINDS,).toContain('a gloss of a name or a term',);
        expect(APPARATUS_KINDS,).toContain('a gloss identifying a person, place or work',);
        expect(APPARATUS_KINDS,).toContain('a translator\'s note explaining a pun',);
        expect(APPARATUS_KINDS,).toContain('an explanatory aside',);
        expect(APPARATUS_KINDS,).toContain('a spelled-out referent',);
        expect(APPARATUS_KINDS,).toContain('a contributor credit',);
        expect(APPARATUS_KINDS,).toContain('ISBN',);
      },
    },),
    it({
      name: 'GIVES the critic the whole list, where an explanatory aside the writers keep was not named',
      fn: async () => {
        expect(critic,).toContain(APPARATUS_KINDS,);
        expect(critic,).toContain('an explanatory aside',);
      },
    },),
    it({
      name: 'GIVES the panel the whole list, where a spelled-out referent the contest keeps was not named',
      fn: async () => {
        expect(panel,).toContain(APPARATUS_KINDS,);
        expect(panel,).toContain('a spelled-out referent',);
      },
    },),
    it({
      name: 'GIVES the contest the whole list, where a citation\'s edition or ISBN was not named',
      fn: async () => {
        expect(CONTEST_POLICY,).toContain(APPARATUS_KINDS,);
        expect(CONTEST_POLICY,).toContain('ISBN',);
      },
    },),
    it({
      name: 'GIVES the writers\' clause the whole list, where an identifying gloss was not named',
      fn: async () => {
        expect(PAGE_APPARATUS_IS_KEPT,).toContain(APPARATUS_KINDS,);
        expect(PAGE_APPARATUS_IS_KEPT,).toContain('a gloss identifying a person',);
      },
    },),
    it({
      name: 'GIVES the archive block review the whole list, where a gloss of a term was not editorial context',
      fn: async () => {
        expect(blockReview,).toContain(APPARATUS_KINDS,);
        expect(blockReview,).toContain('a gloss of a name or a term',);
      },
    },),
    it({
      name: 'BOUNDS the critic and the panel with the narrative rule, so accurate-looking added events are not licensed',
      fn: async () => {
        expect(critic,).toContain(NARRATIVE_DETAIL_IS_NOT_APPARATUS,);
        expect(panel,).toContain(NARRATIVE_DETAIL_IS_NOT_APPARATUS,);
        expect(critic,).toContain('WHAT HAPPENED IS NEVER APPARATUS',);
        expect(panel,).toContain('WHAT HAPPENED IS NEVER APPARATUS',);
      },
    },),
  ],
},);
