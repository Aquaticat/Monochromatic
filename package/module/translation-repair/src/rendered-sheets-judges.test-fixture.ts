/**
 The repair lane's judges and the translate retry, rendered for
 `rendered-sheets.test-fixture.ts` (ledger X17).

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  buildAdjudicationMessages,
  buildDerivabilityMessages,
  buildIntroducedDefectMessages,
  buildRestorationJudgeMessages,
  buildTranslateMessages,
  buildTranslateRepairMessages,
} from '../dist/final/node/index.mjs';

import {
  type RenderedSheet,
  SOURCE,
  ARCHIVE,
  REPAIR,
  IDENTITY,
  REFERENCES,
  TENSE_ISSUE,
  JUDGE_REFERENCE,
  TENSE_REGION,
  joined,
} from './rendered-sheets-texts.test-fixture.ts';

//region Judge sheets

/**
 The repair lane's judges and the translate lane's retry: adjudication, the
 derivability and restoration probes, the introduced-defect check, and the
 translate writer asked again (ledger X17).

 @returns One entry per sheet

 @example
 ```ts
 const sheets = judgeSheets();
 ```
 */
export function judgeSheets(): readonly RenderedSheet[] {
  return [
    {
      name: 'adjudication',
      text: joined({
        messages: buildAdjudicationMessages({
          sourceText: SOURCE,
          targetText: ARCHIVE,
          clusters: [{
            clusterId: 'cluster/tense',
            position: 0,
            members: TENSE_ISSUE.claims,
          },],
          identityContext: IDENTITY,
          referenceContext: REFERENCES,
        },)
          .messages,
      },),
    },
    {
      name: 'derivability',
      text: joined({
        messages: buildDerivabilityMessages({
          sourceText: SOURCE,
          references: [JUDGE_REFERENCE,],
        },)
          .messages,
      },),
    },
    {
      name: 'restoration judge',
      text: joined({
        messages: buildRestorationJudgeMessages({
          sourceText: SOURCE,
          repairedText: REPAIR,
          references: [JUDGE_REFERENCE,],
        },)
          .messages,
      },),
    },
    {
      name: 'introduced defect',
      text: joined({
        messages: buildIntroducedDefectMessages({
          sourceText: SOURCE,
          baselineText: ARCHIVE,
          regions: [TENSE_REGION,],
          issues: [TENSE_ISSUE,],
          identityContext: IDENTITY,
        },)
          .messages,
      },),
    },
    {
      name: 'translate repair',
      text: joined({
        messages: buildTranslateRepairMessages({
          priorMessages: buildTranslateMessages({
            sourceText: SOURCE,
            existingText: ARCHIVE,
            identityContext: IDENTITY,
          },)
            .messages,
          priorTranslation: REPAIR,
          findings: ['The translation drops what the kitten promised.',],
        },),
      },),
    },
  ];
}

//endregion Judge sheets
