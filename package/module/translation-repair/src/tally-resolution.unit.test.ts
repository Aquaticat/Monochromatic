/**
 * Tests for resolution-check wire resolution and majority tallying.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { isResolutionReportWire, } from './resolution-wire.ts';
import {
  resolveResolutionChecks,
  tallyResolutionChecks,
} from './tally-resolution.ts';

/**
 * Issue ids in prompt numbering order for resolution tests.
 */
const ISSUE_IDS = [
  'adjudicated/whisker',
  'adjudicated/paw',
] as const;

await describe({
  name: isResolutionReportWire.name,
  children: [
    it({
      name: 'accepts well-formed reports and rejects malformed ones',
      fn: async () => {
        expect(isResolutionReportWire({
          checks: [
            {
              issue: 1,
              verdict: 'fixed',
            },
          ],
        },),).toBe(true,);
        expect(isResolutionReportWire({ checks: [], },),).toBe(true,);
        expect(isResolutionReportWire({},),).toBe(false,);
        expect(isResolutionReportWire({ checks: [{ issue: 1.5, verdict: 'fixed', },], },),)
          .toBe(false,);
        expect(isResolutionReportWire({ checks: [{ issue: 1, },], },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: resolveResolutionChecks.name,
  children: [
    it({
      name: 'resolves checks through the index map and records irregularities',
      fn: async () => {
        /** Report with one good check, one bad index, one unknown verdict. */
        const ballot = resolveResolutionChecks({
          wire: {
            checks: [
              {
                issue: 1,
                verdict: 'fixed',
              },
              {
                issue: 9,
                verdict: 'fixed',
              },
              {
                issue: 2,
                verdict: 'perfect',
              },
            ],
          },
          issueIds: ISSUE_IDS,
        },);
        expect(ballot.verdicts['adjudicated/whisker'],).toBe('fixed',);
        expect(ballot.verdicts['adjudicated/paw'],).toBe(undefined,);
        expect(ballot.findings,).toContain('check-index-out-of-range (9)',);
        expect(ballot.findings,).toContain('unknown-resolution-verdict (perfect)',);
        expect(ballot.findings,).toContain('missing-check (2)',);
      },
    },),

    it({
      name: 'keeps the first check on duplicates and records the repeat',
      fn: async () => {
        /** Report answering issue one twice. */
        const ballot = resolveResolutionChecks({
          wire: {
            checks: [
              {
                issue: 1,
                verdict: 'fixed',
              },
              {
                issue: 1,
                verdict: 'worse',
              },
              {
                issue: 2,
                verdict: 'not-fixed',
              },
            ],
          },
          issueIds: ISSUE_IDS,
        },);
        expect(ballot.verdicts['adjudicated/whisker'],).toBe('fixed',);
        expect(ballot.findings,).toContain('duplicate-check (1)',);
      },
    },),
  ],
},);

await describe({
  name: tallyResolutionChecks.name,
  children: [
    it({
      name: 'resolves on strict fixed majority and flags worse majorities',
      fn: async () => {
        /** Three checkers: two fixed one not-fixed on the first issue, worse-heavy on the second. */
        const tallies = tallyResolutionChecks({
          issueIds: ISSUE_IDS,
          ballots: {
            a: {
              verdicts: {
                'adjudicated/whisker': 'fixed',
                'adjudicated/paw': 'worse',
              },
              findings: [],
            },
            b: {
              verdicts: {
                'adjudicated/whisker': 'fixed',
                'adjudicated/paw': 'worse',
              },
              findings: [],
            },
            c: {
              verdicts: {
                'adjudicated/whisker': 'not-fixed',
                'adjudicated/paw': 'fixed',
              },
              findings: [],
            },
          },
        },);
        expect(tallies['adjudicated/whisker']?.resolved,).toBe(true,);
        expect(tallies['adjudicated/whisker']?.regressed,).toBe(false,);
        expect(tallies['adjudicated/paw']?.resolved,).toBe(false,);
        expect(tallies['adjudicated/paw']?.regressed,).toBe(true,);
      },
    },),

    it({
      name: 'ties and silence resolve nothing',
      fn: async () => {
        /** One fixed against one not-fixed on the first issue; nobody answers the second. */
        const tallies = tallyResolutionChecks({
          issueIds: ISSUE_IDS,
          ballots: {
            a: {
              verdicts: { 'adjudicated/whisker': 'fixed', },
              findings: [],
            },
            b: {
              verdicts: { 'adjudicated/whisker': 'not-fixed', },
              findings: [],
            },
          },
        },);
        expect(tallies['adjudicated/whisker']?.resolved,).toBe(false,);
        expect(tallies['adjudicated/paw']?.resolved,).toBe(false,);
        expect(tallies['adjudicated/paw']?.regressed,).toBe(false,);
        expect(tallies['adjudicated/paw']?.fixed,).toBe(0,);
      },
    },),
  ],
},);
