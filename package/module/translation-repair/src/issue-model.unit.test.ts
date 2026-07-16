/**
 * Tests for issue taxonomy guards and deterministic claim identity.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { hashContent, } from './document-node.ts';
import {
  computeIssueClaimId,
  type IssueClaim,
  type SpanAnchor,
} from './issue-model.ts';
import {
  categoryFamily,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_FAMILIES,
  ISSUE_SEVERITIES,
  isIssueCategory,
  isIssueSeverity,
} from './issue-taxonomy.ts';

/**
 * Reusable anchored span with invented content;
 * identity tests vary single fields against it.
 */
const BASE_SPAN: SpanAnchor = {
  side: 'target',
  nodeId: 'block/1',
  nodeHash: hashContent({ content: 'The cat naps in the sun.', },),
  startOffset: 30,
  endOffset: 54,
  quotedText: 'The cat naps in the sun.',
};

/**
 * Reusable atomic claim; identity tests vary single fields against it.
 */
const BASE_CLAIM: IssueClaim = {
  category: 'accuracy/omission',
  severity: 'major',
  summary: '猫猫追蝴蝶的句子没有翻译。',
  spans: [BASE_SPAN,],
};

await describe({
  name: categoryFamily.name,
  children: [
    it({
      name: 'returns family segment for compound family slugs',
      fn: async () => {
        expect(categoryFamily({ category: 'locale-convention/quotation-marks', },),)
          .toBe('locale-convention',);
      },
    },),

    it({
      name: 'maps every listed category into a known family',
      fn: async () => {
        /** Families actually derivable from the category list. */
        const derived = [
          ...new Set(ISSUE_CATEGORIES.map(function toFamily(category,) {
            return categoryFamily({ category, },);
          },),),
        ]
          .toSorted();
        expect(derived,).toEqual([
          'accuracy',
          'extension',
          'fluency',
          'locale-convention',
          'policy',
          'style',
          'terminology',
        ],);
        // Completeness pin in the other direction: the hand-listed family const
        // covers exactly the families the category slugs derive.
        expect([...ISSUE_CATEGORY_FAMILIES,].toSorted(),).toEqual(derived,);
      },
    },),
  ],
},);

await describe({
  name: isIssueCategory.name,
  children: [
    it({
      name: 'accepts every listed category',
      fn: async () => {
        for (const category of ISSUE_CATEGORIES) {
          expect(isIssueCategory(category,),).toBe(true,);
        }
      },
    },),

    it({
      name: 'rejects unknown slugs and non-strings',
      fn: async () => {
        expect(isIssueCategory('accuracy/nonexistent',),).toBe(false,);
        expect(isIssueCategory('accuracy',),).toBe(false,);
        expect(isIssueCategory(42,),).toBe(false,);
        expect(isIssueCategory(undefined,),).toBe(false,);
        expect(isIssueCategory({ category: 'accuracy/omission', },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: isIssueSeverity.name,
  children: [
    it({
      name: 'accepts every listed severity and rejects everything else',
      fn: async () => {
        for (const severity of ISSUE_SEVERITIES) {
          expect(isIssueSeverity(severity,),).toBe(true,);
        }
        expect(isIssueSeverity('catastrophic',),).toBe(false,);
        expect(isIssueSeverity(1,),).toBe(false,);
        expect(isIssueSeverity(null,),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: computeIssueClaimId.name,
  children: [
    it({
      name: 'returns identical prefixed ids for structurally identical claims',
      fn: async () => {
        /** Identity of base claim computed twice from separate literals. */
        const first = computeIssueClaimId({
          claim: {
            ...BASE_CLAIM,
            spans: [{ ...BASE_SPAN, },],
          },
        },);
        expect(first,).toBe(computeIssueClaimId({ claim: BASE_CLAIM, },),);
        expect(first.startsWith('issue/',),).toBe(true,);
      },
    },),

    it({
      name: 'changes identity when summary changes',
      fn: async () => {
        /** Identity of claim differing only in summary wording. */
        const reworded = computeIssueClaimId({
          claim: { ...BASE_CLAIM, summary: '缺少追蝴蝶那句的译文。', },
        },);
        expect(reworded === computeIssueClaimId({ claim: BASE_CLAIM, },),).toBe(false,);
      },
    },),

    it({
      name: 'changes identity when quoted evidence changes',
      fn: async () => {
        /** Identity of claim whose span quotes different text. */
        const requoted = computeIssueClaimId({
          claim: {
            ...BASE_CLAIM,
            spans: [{ ...BASE_SPAN, quotedText: 'The cat naps in the moon.', },],
          },
        },);
        expect(requoted === computeIssueClaimId({ claim: BASE_CLAIM, },),).toBe(false,);
      },
    },),

    it({
      name: 'treats span order as claim-relevant',
      fn: async () => {
        /** Second span differing only in offsets, for order sensitivity. */
        const shifted: SpanAnchor = {
          ...BASE_SPAN,
          startOffset: 0,
          endOffset: 0,
          quotedText: '',
        };
        /** Identity with spans in one order. */
        const forward = computeIssueClaimId({
          claim: { ...BASE_CLAIM, spans: [BASE_SPAN, shifted,], },
        },);
        /** Identity with same spans reversed. */
        const backward = computeIssueClaimId({
          claim: { ...BASE_CLAIM, spans: [shifted, BASE_SPAN,], },
        },);
        expect(forward === backward,).toBe(false,);
      },
    },),
  ],
},);
