/**
 Tests for the lines the audit sensitivity runner prints.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  armLines,
  keptLine,
  RUN_MODELS,
  sightedVoices,
  voiceLines,
} from '../../dist/final/node/index.mjs';
import { auditReportOver, } from '../audit-report.test-fixture.ts';
import {
  ELSEWHERE_FINDING,
  NARROW_POLARITY_FINDING,
  POLARITY_FINDING,
  QUIET_AUDIT_REPORT,
  UNKNOWN_CATEGORY_FINDING,
} from '../audit-scripted-client.test-fixture.ts';

/**
 The three auditors of the roster.
 */
const FIRST = nonNullishOrThrow(RUN_MODELS.checkerModelIds[0],);
const SECOND = nonNullishOrThrow(RUN_MODELS.checkerModelIds[1],);
const THIRD = nonNullishOrThrow(RUN_MODELS.checkerModelIds[2],);

await describe({
  name: '',
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    describe({
      name: voiceLines.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PRINTS the voice line alone for a voice that claimed nothing and dropped nothing',
          fn: async () => {
            /**
             Every voice quiet.
             */
            const report = await auditReportOver({
              reportFor: function quiet() {
                return QUIET_AUDIT_REPORT;
              },
              clean: true,
            },);

            expect(voiceLines({
              row: nonNullishOrThrow(report.rows[0],),
              arm: 'clean',
            },),).toEqual([
              `  VOICE clean ${nonNullishOrThrow(report.rows[0],).modelId} verdict=no-defect-found claims=0 `
              + 'oracleHits=0 dropped=0',
            ],);
          },
        },),

        it({
          name: 'PRINTS one line per claim marked ORACLE or other, a dash for an unused side, and the reason each dropped claim fell',
          fn: async () => {
            /**
             First voice points at the span and elsewhere; second drops one claim.
             */
            const report = await auditReportOver({
              reportFor: function perVoice(modelId,) {
                return {
                  verdict: 'defects-found',
                  findings: (modelId === FIRST)
                    ? [
                      POLARITY_FINDING,
                      ELSEWHERE_FINDING,
                    ]
                    : [
                      NARROW_POLARITY_FINDING,
                      UNKNOWN_CATEGORY_FINDING,
                    ],
                };
              },
              clean: false,
            },);

            expect(voiceLines({
              row: nonNullishOrThrow(report.rows[0],),
              arm: 'flipped',
            },),).toEqual([
              `  VOICE flipped ${FIRST} verdict=defects-found claims=2 oracleHits=1 dropped=0`,
              '    ORACLE altered-polarity: 不吃罐头 || eat canned food',
              '    other  omission: 窗台 || -',
            ],);
            expect(voiceLines({
              row: nonNullishOrThrow(report.rows[1],),
              arm: 'flipped',
            },),).toEqual([
              `  VOICE flipped ${SECOND} verdict=defects-found claims=1 oracleHits=1 dropped=1 [unknown-category (bogus)]`,
              '    ORACLE altered-polarity: 不吃 || They eat',
            ],);
          },
        },),
      ],
    },),

    describe({
      name: armLines.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PRINTS the tally, each voice, the corroborated defect, the agreement and each near miss',
          fn: async () => {
            /**
             Two voices agree exactly, the third quotes a narrower span and drops a claim.
             */
            const report = await auditReportOver({
              reportFor: function perVoice(modelId,) {
                return {
                  verdict: 'defects-found',
                  findings: (modelId === THIRD)
                    ? [
                      NARROW_POLARITY_FINDING,
                      UNKNOWN_CATEGORY_FINDING,
                    ]
                    : [POLARITY_FINDING,],
                };
              },
              clean: false,
            },);

            expect(armLines({
              arm: 'flipped',
              expectation: 'agreement',
              report,
              oracleVoices: sightedVoices({ rows: report.rows, },).length,
              roster: RUN_MODELS.checkerModelIds,
            },),).toEqual([
              'SENSITIVITY arm=flipped expected=agreement heard=3/3 corroborated=1 agreed=1 agreedVoices=3 near=2 '
              + 'oracleVoices=3 findings=0',
              `  VOICE flipped ${FIRST} verdict=defects-found claims=1 oracleHits=1 dropped=0`,
              '    ORACLE altered-polarity: 不吃罐头 || eat canned food',
              `  VOICE flipped ${SECOND} verdict=defects-found claims=1 oracleHits=1 dropped=0`,
              '    ORACLE altered-polarity: 不吃罐头 || eat canned food',
              `  VOICE flipped ${THIRD} verdict=defects-found claims=1 oracleHits=1 dropped=1 [unknown-category (bogus)]`,
              '    ORACLE altered-polarity: 不吃 || They eat',
              '  CORROBORATED flipped altered-polarity voices=2 at 不吃罐头 || eat canned food',
              '  AGREED flipped altered-polarity voices=3 spans=不吃 / 不吃罐头 / 不吃罐头',
              `  NEAR flipped overlapping-focus: altered-polarity (${FIRST}) against altered-polarity (${THIRD})`,
              `  NEAR flipped overlapping-focus: altered-polarity (${SECOND}) against altered-polarity (${THIRD})`,
            ],);
          },
        },),

        it({
          name: 'PRINTS the tally with agreedVoices 0 and no further line when every voice is quiet',
          fn: async () => {
            /**
             Every voice quiet.
             */
            const report = await auditReportOver({
              reportFor: function quiet() {
                return QUIET_AUDIT_REPORT;
              },
              clean: true,
            },);

            expect(armLines({
              arm: 'clean',
              expectation: 'agreement at neither tier',
              report,
              oracleVoices: 0,
              roster: RUN_MODELS.checkerModelIds,
            },),).toEqual([
              'SENSITIVITY arm=clean expected=agreement at neither tier heard=3/3 corroborated=0 agreed=0 '
              + 'agreedVoices=0 near=0 oracleVoices=0 findings=0',
              ...report.rows.map(function quietVoice(row,): string {
                return `  VOICE clean ${row.modelId} verdict=no-defect-found claims=0 oracleHits=0 dropped=0`;
              },),
            ],);
          },
        },),

        it({
          name: 'PRINTS a DEGRADED line for each finding when a voice is lost',
          fn: async () => {
            /**
             Third voice silent.
             */
            const report = await auditReportOver({
              reportFor: function quiet() {
                return QUIET_AUDIT_REPORT;
              },
              silent: [THIRD,],
              clean: true,
            },);

            expect(armLines({
              arm: 'clean',
              expectation: 'agreement at neither tier',
              report,
              oracleVoices: 0,
              roster: RUN_MODELS.checkerModelIds,
            },),).toEqual([
              'SENSITIVITY arm=clean expected=agreement at neither tier heard=2/3 corroborated=0 agreed=0 '
              + 'agreedVoices=0 near=0 oracleVoices=0 findings=2',
              `  VOICE clean ${FIRST} verdict=no-defect-found claims=0 oracleHits=0 dropped=0`,
              `  VOICE clean ${SECOND} verdict=no-defect-found claims=0 oracleHits=0 dropped=0`,
              `  DEGRADED clean stage-voice-lost (runRenderingAudit ${THIRD})`,
              '  DEGRADED clean stage-roster-incomplete (runRenderingAudit 2/3)',
            ],);
          },
        },),
      ],
    },),

    describe({
      name: keptLine.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'SAYS one arm in the singular and where it was kept',
          fn: async () => {
            expect(keptLine({
              count: 1,
              keptAt: '/cats/runs/audit-sensitivity/run.json',
            },),).toBe('SENSITIVITY kept 1 arm at /cats/runs/audit-sensitivity/run.json',);
          },
        },),

        it({
          name: 'SAYS several arms, and none, in the plural',
          fn: async () => {
            expect(keptLine({
              count: 2,
              keptAt: '/cats/run.json',
            },),).toBe('SENSITIVITY kept 2 arms at /cats/run.json',);
            expect(keptLine({
              count: 0,
              keptAt: '/cats/run.json',
            },),).toBe('SENSITIVITY kept 0 arms at /cats/run.json',);
          },
        },),
      ],
    },),
  ],
},);
