/**
 * Locks down the decision boundaries exposed by Mio12's cached archive review.
 *
 * @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { runArchiveBlockReviewStage, } from '../dist/final/node/index.mjs';
import {
  archiveSelectionFixture,
  ARCHIVE_TEST_BLOCK,
  ARCHIVE_TEST_CORRECTION,
  ARCHIVE_TEST_PAGE,
  ARCHIVE_TEST_PARTIAL,
  ARCHIVE_TEST_ROSTER,
  ARCHIVE_TEST_SOURCE,
} from './archive-selection.test-fixture.ts';

/**
 * Runs the real stage with a caller-local source/target pair and no provider access.
 *
 * @param fixture - scripted reviews and independent selection
 * @returns Actual stage outcome
 */
async function runFixture(fixture: ReturnType<typeof archiveSelectionFixture>,): ReturnType<typeof runArchiveBlockReviewStage> {
  return await runArchiveBlockReviewStage({
    client: fixture.client,
    modelIds: ARCHIVE_TEST_ROSTER,
    sourceText: ARCHIVE_TEST_SOURCE,
    targetText: ARCHIVE_TEST_PAGE,
    blockText: ARCHIVE_TEST_BLOCK,
    priorFindings: [],
    signal: AbortSignal.timeout(5_000,),
    exchangeTimeoutMs: 5_000,
    l: tagged({ tag: 'archive-selection-boundary', },),
  },);
}

await describe({
  name: 'archive review selection boundary',
  children: [
    it({
      name: 'ROUTES existing revisions to independent selection despite insufficient retention anchors',
      fn: async () => {
        const fixture = archiveSelectionFixture({},);
        const result = await runFixture(fixture,);
        expect(fixture.reviews(),).toBe(7,);
        expect(result.kind,).toBe('revised',);
        expect(result.text,).toBe(ARCHIVE_TEST_CORRECTION,);
        expect(fixture.selections.length,).toBeGreaterThan(0,);
        const message = fixture.selections[0] ?? '';
        expect(message,).toContain(ARCHIVE_TEST_SOURCE,);
        expect(message,).toContain(ARCHIVE_TEST_PARTIAL,);
        expect(message,).toContain(ARCHIVE_TEST_BLOCK,);
        expect(message,).not.toContain('Unanchored retention opinion.',);
        expect(result.findings,).toContain('Unanchored retention opinion.',);
      },
    },),
    it({
      name: 'PRESERVES archive context and review action rather than presenting all reasons as defects',
      fn: async () => {
        const fixture = archiveSelectionFixture({ review: 'all-anchored', },);
        await runFixture(fixture,);
        const message = fixture.selections[0] ?? '';
        expect(message,).toContain('Following archive context.',);
        expect(message,).toContain('PRIOR REVIEW ASSESSMENTS',);
        expect(message,).toContain('"proposedAction":"retain"',);
        expect(message,).toContain('"proposedAction":"revise"',);
        expect(message,).toContain('"disposition":"source-supported"',);
        expect(message,).toContain('"candidate":',);
      },
    },),
    it({
      name: 'RETURNS retained when the independent selector chooses the explicit original option',
      fn: async () => {
        const fixture = archiveSelectionFixture({ selection: 'original', },);
        const result = await runFixture(fixture,);
        expect(fixture.selections.length,).toBeGreaterThan(0,);
        expect(result.kind,).toBe('retained',);
        expect(result.text,).toBe(ARCHIVE_TEST_BLOCK,);
        expect(fixture.selections[0] ?? '',).toContain(`\n${ARCHIVE_TEST_BLOCK}\n`,);
      },
    },),
    it({
      name: 'DOES NOT SHIP even a sole revision without independent selector quorum',
      fn: async () => {
        const fixture = archiveSelectionFixture({ review: 'single', selection: 'unavailable', },);
        const result = await runFixture(fixture,);
        expect(fixture.selections.length,).toBeGreaterThan(0,);
        expect(result.kind,).toBe('retained',);
        expect(result.text,).toBe(ARCHIVE_TEST_BLOCK,);
        const message = fixture.selections[0] ?? '';
        expect(message,).toContain(`\n${ARCHIVE_TEST_CORRECTION}\n`,);
        expect(message,).toContain(`\n${ARCHIVE_TEST_BLOCK}\n`,);
      },
    },),
    it({
      name: 'DEDUPLICATES an echoed original and records the selected no-op as retained',
      fn: async () => {
        const fixture = archiveSelectionFixture({ review: 'echo', selection: 'original', },);
        const result = await runFixture(fixture,);
        expect(result.kind,).toBe('retained',);
        expect(result.text,).toBe(ARCHIVE_TEST_BLOCK,);
        expect((fixture.selections[0] ?? '').split('CANDIDATE ',),).toHaveLength(2,);
      },
    },),
    it({
      name: 'CARRIES earlier findings separately from current typed assessments',
      fn: async () => {
        const fixture = archiveSelectionFixture({},);
        await runArchiveBlockReviewStage({
          client: fixture.client, modelIds: ARCHIVE_TEST_ROSTER,
          sourceText: ARCHIVE_TEST_SOURCE, targetText: ARCHIVE_TEST_PAGE, blockText: ARCHIVE_TEST_BLOCK,
          priorFindings: ['Earlier independent concern.',],
          signal: AbortSignal.timeout(5_000,), exchangeTimeoutMs: 5_000,
          l: tagged({ tag: 'archive-prior-evidence-test', },),
        },);
        const message = fixture.selections[0] ?? '';
        expect(message,).toContain('EARLIER REVIEW FINDINGS, prior opinions only',);
        expect(message,).toContain('Earlier independent concern.',);
        expect(message,).toContain('PRIOR REVIEW ASSESSMENTS',);
      },
    },),
    it({
      name: 'KEEPS the unresolved fallback for retention-only reviews lacking anchored participation',
      fn: async () => {
        const fixture = archiveSelectionFixture({ review: 'retention-only', },);
        const result = await runFixture(fixture,);
        expect(result.kind,).toBe('retained',);
        expect(fixture.selections,).toHaveLength(0,);
        expect(result.findings.some(function unresolved(finding,) {
          return finding.includes('left the block unresolved',);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'STILL INTERRUPTS when the initial review itself lacks participation quorum',
      fn: async () => {
        const fixture = archiveSelectionFixture({ review: 'unavailable', },);
        let caught: unknown;
        try {
          await runFixture(fixture,);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toHaveProperty('name', 'TranslationRepairInterruptedError',);
        expect(fixture.selections,).toHaveLength(0,);
      },
    },),
  ],
},);
