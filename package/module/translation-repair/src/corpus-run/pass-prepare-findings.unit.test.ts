/**
 Guards ledger X18: what the preparation's evidence rounds report (the
 reference attestation's findings, the page title lexicon's) reaches the
 entry's findings on every way out of the preparation. The way out through a
 corrected archive once rebuilt its findings from the re-preparation and
 dropped the attestation's.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  PAGE_TITLE_LEXICON_RESPONSE_FORMAT,
  type PipelineDigest,
  preparePassEntry,
  REFERENCE_ATTEST_RESPONSE_FORMAT,
  type RosterModelId,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

import { NO_OUTSIDE_READS, } from './pass-outside-reads.test-fixture.ts';

/**
 Logger the preparation writes to, whose lines are not under test.
 */
const l = tagged({ tag: 'pass-prepare-findings-test', },);

/**
 Roster the preparation asks: four seats, so the correction slate has judges
 who did not write the revision, whose ballots count in full.
 */
const ROSTER: readonly RosterModelId[] = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
];

/**
 Cache generation the preparation's caches are stamped with.
 */
const DIGEST = 'pass-prepare-findings-test' as PipelineDigest;

/**
 Original repeating one title, in one block.
 */
const SOURCE = '小猫唱了《猫之歌》，又唱了《猫之歌》。';

/**
 Archive rendering of the original's one block.
 */
const RENDERED = 'The kitten sang the song twice.';

/**
 What the one page the original links says.
 */
const REFERENCE_LINES = '- reference 1 https://cats.example/posts/mittens ("Mittens"): Mittens had a brother who sat by the stove.';

/**
 How the archive reviewers answer an unclaimed block.
 */
type Review = 'revise' | 'unanchored';

/**
 Builds a client answering every sheet the preparation asks: an attestation
 whose archive quote is not in the archive, so the round reports a discard;
 one rendering of the title; a review that revises the unclaimed block or
 claims support the original does not hold; a ballot for the first
 candidate; and one pairing for every pairing round.

 @param review - how the reviewers answer

 @param asked - sink for the name of every sheet asked

 @returns Client serving only structured calls

 @example
 ```ts
 const client = evidenceClient({ review: 'revise', asked: [], },);
 ```
 */
function evidenceClient(
  {
    review,
    asked,
  }: {
    readonly review: Review;
    readonly asked: string[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Sheet asked.
       */
      const schema = request.responseFormat?.json_schema.name ?? '';
      asked.push(schema,);
      /**
       Reply per sheet.
       */
      const replies: Readonly<Record<string, unknown>> = {
        [REFERENCE_ATTEST_RESPONSE_FORMAT.json_schema.name]: {
          attested: [{
            archiveQuote: 'The cat wore a golden crown.',
            reference: 1,
            referenceQuote: 'Mittens had a brother',
          },],
        },
        [PAGE_TITLE_LEXICON_RESPONSE_FORMAT.json_schema.name]: {
          titles: [{ title: 1, rendering: 'Song of the Cat', },],
        },
        [ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT.json_schema.name]: (review === 'revise')
          ? {
            disposition: 'revise',
            sourceQuote: '',
            replacementText: 'Aside B',
            finding: 'Remove unsupported archive-only wording.',
          }
          : {
            disposition: 'source-supported',
            sourceQuote: 'Cats purr.',
            replacementText: '',
            finding: 'The original supports it.',
          },
        candidate_ballot: {
          best: 1,
          reason: 'Correction removes unsupported wording.',
        },
      };
      /**
       Reply to this sheet, one pairing where no other is scripted.
       */
      const value = replies[schema] ?? { pairs: [{ source: 0, target: 0, },], };
      if (!request.validate(value,))
        throw new Error(`scripted ${schema} reply failed validator`,);
      return { kind: 'ok', value, rawText: JSON.stringify(value,), };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

/**
 Prepares the original against an archive, the original linking one page.

 @param targetText - archive page

 @param review - how the reviewers answer an unclaimed block

 @returns Prepared archive, findings and the sheets asked

 @example
 ```ts
 const run = await prepared({ targetText: RENDERED, review: 'revise', },);
 ```
 */
async function prepared(
  {
    targetText,
    review,
  }: {
    readonly targetText: string;
    readonly review: Review;
  },
) {
  /**
   Name of every sheet asked.
   */
  const asked: string[] = [];
  /**
   Directory this case owns for its entry caches.
   */
  const dir = await mkdtemp(join(tmpdir(), 'pass-prepare-findings-',),);
  /**
   The preparation.
   */
  const paired = await preparePassEntry({
    client: evidenceClient({ review, asked, },),
    entryId: 'CatEntry',
    entryCacheDir: dir,
    pipelineDigest: DIGEST,
    modelIds: ROSTER,
    sourceText: SOURCE,
    targetText,
    signal: new AbortController().signal,
    exchangeTimeoutMs: 5_000,
    l,
    outsideReads: {
      ...NO_OUTSIDE_READS,
      references: async () => REFERENCE_LINES,
    },
  },);
  await rm(dir, { recursive: true, force: true, },);
  return {
    targetText: paired.prepared.targetText,
    findings: paired.findings,
    reviewed: asked.includes(ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT.json_schema.name,),
  };
}

/**
 Whether each evidence round's report reached the findings.

 @param findings - the preparation's findings

 @returns One flag per evidence round

 @example
 ```ts
 const reached = evidenceReported({ findings, },);
 ```
 */
function evidenceReported({ findings, }: { readonly findings: readonly string[]; },) {
  return {
    attestation: findings.some(function reportsDiscard(finding,): boolean {
      return finding.startsWith('reference attestation discarded',);
    },),
    pageTitles: findings.some(function reportsLexicon(finding,): boolean {
      return finding.startsWith('page title lexicon settled 1 of 1',);
    },),
  };
}

await describe({
  name: 'preparePassEntry keeps its evidence findings on every way out (ledger X18)',
  children: [
    it({
      name: 'KEEPS THEM when the archive leaves no block unclaimed, and asks no review',
      fn: async () => {
        /**
         Preparation over an archive the pairing claims whole.
         */
        const claimed = await prepared({ targetText: RENDERED, review: 'revise', },);
        expect({
          reviewed: claimed.reviewed,
          ...evidenceReported({ findings: claimed.findings, },),
        },).toEqual({
          reviewed: false,
          attestation: true,
          pageTitles: true,
        },);
      },
    },),
    it({
      name: 'KEEPS THEM when the review leaves the archive as it stands',
      fn: async () => {
        /**
         Preparation whose review claims support the original lacks.
         */
        const retained = await prepared({ targetText: `${RENDERED}\n\nAside A`, review: 'unanchored', },);
        expect({
          reviewed: retained.reviewed,
          archiveStands: retained.targetText.includes('Aside A',),
          ...evidenceReported({ findings: retained.findings, },),
        },).toEqual({
          reviewed: true,
          archiveStands: true,
          attestation: true,
          pageTitles: true,
        },);
      },
    },),
    it({
      name: 'KEEPS THEM when the review corrects the archive and the preparation runs again',
      fn: async () => {
        /**
         Preparation whose review revises the unclaimed block.
         */
        const corrected = await prepared({ targetText: `${RENDERED}\n\nAside A`, review: 'revise', },);
        expect({
          reviewed: corrected.reviewed,
          corrected: corrected.targetText.includes('Aside B',),
          ...evidenceReported({ findings: corrected.findings, },),
        },).toEqual({
          reviewed: true,
          corrected: true,
          attestation: true,
          pageTitles: true,
        },);
      },
    },),
  ],
},);
