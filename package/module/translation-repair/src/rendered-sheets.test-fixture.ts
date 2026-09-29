import {
  buildAbsoluteNaturalnessReviewMessages,
  buildCandidateSelectMessages,
  buildConsolidateGateMessages,
  buildConsolidateMessages,
  buildConsolidationPolishGateMessages,
  buildCoverageMessages,
  buildCriticMessages,
  buildEditorMessages,
  buildLaneContestMessages,
  buildPageTitleLexiconMessages,
  buildRefineMessages,
  buildRenderingAuditMessages,
  buildResolutionMessages,
  buildTranslateMessages,
  HOUSE_POLICY_BLOCK,
  TRANSLATE_SELECTION_TASK,
  translateSelectionCriteria,
  translateSlateEvidence,
} from '../dist/final/node/index.mjs';
import {
  type RenderedSheet,
  SOURCE,
  ARCHIVE,
  REPAIR,
  IDENTITY,
  REFERENCES,
  TENSE_ISSUE,
  joined,
} from './rendered-sheets-texts.test-fixture.ts';
import { evidenceSheets, } from './rendered-sheets-preparation.test-fixture.ts';
import { judgeSheets, } from './rendered-sheets-judges.test-fixture.ts';
import { slateSheets, } from './rendered-sheets-slates.test-fixture.ts';

export type { RenderedSheet, } from './rendered-sheets-texts.test-fixture.ts';

//region Rendered sheets
// EVERY MODEL-FACING SHEET, rendered once with invented cat fixtures, so a
// guard about what the models read (a spelling, a precedence line, a rule
// every sheet must carry) checks every sheet at once rather than the one
// sheet its class happened to find. Built for the whole-package audit of
// 2026-09-27, whose sheet audits rendered the same sheets by hand. These
// strings are authored test data, never copied corpus passages.
//
// "EVERY" WAS FIFTEEN UNTIL LEDGER X17 (2026-09-28): the attestation, the
// pairing rounds, the archive review and its slate, the repair lane's judges,
// the picture readers, every other selection slate and the typed decision were
// missing, and the picture readers' "summarise" had never met the Canadian
// spelling guard. `rendered-sheets-census.unit.test.ts` now fails when a sheet
// builder the package exports is rendered by none of these fixtures.

/**
 Every model-facing sheet the package builds, rendered with the fixtures.

 @returns One entry per sheet, named by its stage

 @example
 ```ts
 const sheets = renderedSheets();
 ```
 */
export function renderedSheets(): readonly RenderedSheet[] {
  /**
   Editor exchange, whose messages the sheet joins.
   */
  const editorPlan = buildEditorMessages({
    sourceText: SOURCE,
    targetText: ARCHIVE,
    envelopes: [],
    issues: [],
    // What `repair-editor-stage.ts` passes it (ledger S14).
    identityContext: IDENTITY,
    referenceContext: REFERENCES,
  },);
  /**
   Refiner exchange, whose messages the sheet joins.
   */
  const refinePlan = buildRefineMessages({
    sourceText: SOURCE,
    envelopes: [],
    identityContext: IDENTITY,
    referenceContext: REFERENCES,
  },);
  /**
   Translate writer exchange, whose messages the sheet joins.
   */
  const translatePlan = buildTranslateMessages({
    sourceText: SOURCE,
    existingText: ARCHIVE,
    identityContext: IDENTITY,
  },);
  /**
   Coverage exchange, whose messages the sheet joins.
   */
  const coveragePlan = buildCoverageMessages({
    sourcePassage: SOURCE,
    translationText: ARCHIVE,
    // What insertion admission passes it since ledger B28.
    identityContext: IDENTITY,
  },);
  /**
   Resolution exchange, whose messages the sheet joins.
   */
  const resolutionPlan = buildResolutionMessages({
    sourceText: SOURCE,
    patchedText: REPAIR,
    issues: [TENSE_ISSUE,],
    identityContext: IDENTITY,
    referenceContext: REFERENCES,
  },);
  return [
    {
      name: 'house policy',
      text: HOUSE_POLICY_BLOCK,
    },
    {
      name: 'critic',
      text: joined({
        messages: buildCriticMessages({
          sourceText: SOURCE,
          targetText: ARCHIVE,
          identityContext: IDENTITY,
          referenceContext: REFERENCES,
        },),
      },),
    },
    {
      name: 'editor',
      text: joined({
        messages: editorPlan.messages,
      },),
    },
    {
      name: 'refiner',
      text: joined({
        messages: refinePlan.messages,
      },),
    },
    {
      name: 'translate writer',
      text: joined({
        messages: translatePlan.messages,
      },),
    },
    {
      name: 'consolidation writer',
      text: joined({
        messages: buildConsolidateMessages({
          subject: {
            sourceText: SOURCE,
            incumbentText: ARCHIVE,
            repairText: REPAIR,
            translateText: REPAIR,
            ballots: [],
            lineStructured: false,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'lane contest',
      text: joined({
        messages: buildLaneContestMessages({
          subject: {
            lineStructured: false,
            sourceText: SOURCE,
            incumbentText: ARCHIVE,
            repairText: REPAIR,
            translateText: REPAIR,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'consolidate gate',
      text: joined({
        messages: buildConsolidateGateMessages({
          subject: {
            lineStructured: false,
            sourceText: SOURCE,
            incumbentText: ARCHIVE,
            consolidatedText: REPAIR,
            standingText: ARCHIVE,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'polish gate',
      text: joined({
        messages: buildConsolidationPolishGateMessages({
          subject: {
            sourceText: SOURCE,
            archiveText: ARCHIVE,
            baseText: ARCHIVE,
            polishedText: REPAIR,
            mode: { kind: 'comparative', },
            lineStructured: false,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'translate slate',
      text: joined({
        messages: buildCandidateSelectMessages({
          task: TRANSLATE_SELECTION_TASK,
          criteria: translateSelectionCriteria({ lineStructured: false, },),
          // The evidence `judgeTranslateSlate` sends.
          evidence: translateSlateEvidence({
            sourceText: SOURCE,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },),
          rendered: [
            ARCHIVE,
            REPAIR,
          ],
          sourceText: SOURCE,
        },),
      },),
    },
    {
      name: 'coverage',
      text: joined({
        messages: coveragePlan.messages,
      },),
    },
    {
      name: 'naturalness review',
      text: joined({
        messages: buildAbsoluteNaturalnessReviewMessages({
          subject: {
            lineStructured: false,
            sourceText: SOURCE,
            candidateText: ARCHIVE,
            paragraphs: [ARCHIVE,],
            identityContext: IDENTITY,
          },
        },),
      },),
    },
    {
      name: 'rendering audit',
      text: joined({
        messages: buildRenderingAuditMessages({
          subject: {
            sourceText: SOURCE,
            candidateText: ARCHIVE,
            // What `corpus-run/rendering-audit-settled-buy.ts` passes a page that declares names.
            identityContext: IDENTITY,
          },
        },),
      },),
    },
    {
      name: 'resolution',
      text: joined({
        messages: resolutionPlan.messages,
      },),
    },
    {
      name: 'page title lexicon',
      text: joined({
        messages: buildPageTitleLexiconMessages({
          sourceText: SOURCE,
          titles: ['猫之歌',],
          identityContext: IDENTITY,
        },),
      },),
    },
    ...evidenceSheets(),
    ...judgeSheets(),
    ...slateSheets(),
  ];
}

//endregion Rendered sheets
