/**
 * Tests for publishing one settled entry as a page in the mirrored corpus tree.
 *
 * DRIVEN THROUGH THE REAL ASSEMBLER, `spliceSlices`, rather than a stub of it.
 * The publisher's whole job is to put the deciders' answers back where they
 * came from, and every way of getting that wrong lives in the join between a
 * reading and the span it belongs to: an index read positionally, an offset
 * recovered by searching for text, a slice written twice. A fixture assembler
 * would agree with whatever the publisher did.
 *
 * THE ARCHIVE HERE IS A WHOLE LITTLE DOCUMENT, not one paragraph, because the
 * property that matters most is what the publisher does NOT touch. A page
 * assembled correctly is byte-identical outside the slices that were replaced,
 * and only text either side of a replaced span can show that.
 *
 * THE TWO PURE SUBJECTS LIVE IN `publish-fixed-replacements.unit.test.ts`, apart
 * from these. A file is abandoned once any describe in it fails, so while they
 * shared one, a break in the replacement builder left every case here unrun and
 * unreported: the runner named one narrow failure where the real blast radius
 * was every page the pass writes.
 *
 * ONE CASE PROVES A BRANCH THE CORPUS CANNOT REACH. No slice in any settled
 * artifact on disk carries an archive that holds no wording, 249 of 249 at the
 * last count, so the silent readings are unreachable there and a measurement
 * over real output can only report zero. Whether the publisher does the right
 * thing when a decider ships nothing into a passage the original speaks is
 * therefore settled here, by a fixture built to be in that state.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { existsSync, } from 'node:fs';
import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  ContributorCompletenessError,
  type DestinationCheck,
  DroppedDestinationError,
  type ChunkPair,
  fixedPagePath,
  publishFixedPage,
  PublishedPageDisagreesError,
  shippableReplacements,
  SliceSpliceError,
  spliceSlices,
  type WouldShipSource,
} from '../../dist/final/node/index.mjs';

//region The archive this entry starts from

/**
 * Opening paragraph, which no case ever replaces.
 *
 * ITS JOB IS TO STAY PUT. Every case that replaces a later slice asserts this
 * text survived unchanged, which is what distinguishes a publisher that wrote
 * one span from one that rebuilt the document out of the pieces it knew about.
 */
const OPENING = '## Description\n\nA tabby who kept the bookshop company for eleven years.\n';

/**
 * Middle paragraph, the slice the deciders act on.
 */
const ARCHIVE_MIDDLE = '\nShe slept on the counter by the till.\n';

/**
 * Closing paragraph, which no case replaces either.
 */
const CLOSING = '\n## Remembered by\n\nEveryone who came in out of the rain.\n';

/**
 * Whole archive English, as the corpus holds it.
 *
 * ENDS IN EXACTLY ONE NEWLINE, and every case that publishes an untouched
 * entry asserts the published bytes still do. Nothing in the publisher may
 * normalize a document's ending: the corpus went to subprocess-level lengths
 * to preserve it on the way in.
 */
const ARCHIVE = `${OPENING}${ARCHIVE_MIDDLE}${CLOSING}`;

/**
 * Source page the archive translates, linking nowhere, so the destination check
 * has nothing to report unless a case says otherwise.
 */
const SOURCE_PAGE = '## 简介\n\n一只在书店陪了十一年的虎斑猫。\n';

/**
 * Where the middle paragraph starts.
 */
const MIDDLE_START = OPENING.length;

/**
 * Where it ends.
 */
const MIDDLE_END = MIDDLE_START + ARCHIVE_MIDDLE.length;

/**
 * Wording a decider settled on for that middle slice.
 */
const DECIDED_MIDDLE = '\nShe slept on the counter beside the till, in the sun.\n';

//endregion The archive this entry starts from

//region Fixtures

/**
 * Builds one pair from a translation-side span.
 *
 * THE SOURCE SIDE ALWAYS SAYS SOMETHING, deliberately: `spliceSlices` reads the
 * original to decide whether writing nothing into a place is a deletion or a
 * passage lost, so a silent source would make the refusal case below
 * untestable. Its offsets are the Chinese document's and nothing here reads
 * them, since only the translation side is written into.
 *
 * @param target - translation-side chunk, carrying the span to write into
 *
 * @returns Pair the publisher may write into
 *
 * @example
 * ```ts
 * const pair = pairOver({ target: { sliceIndex: 0, ... }, },);
 * ```
 */
function pairOver(
  { target, }: { readonly target: Record<string, unknown>; },
): ChunkPair {
  return {
    source: {
      sliceIndex: target.sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '她睡在收银台上。',
    },
    target,
  } as unknown as ChunkPair;
}

/**
 * Builds the whole document's slices, opening and closing included.
 *
 * SLICED WHOLE RATHER THAN AT THE ONE PARAGRAPH UNDER TEST, because the
 * assembler refuses any other shape: it reads a slice's index as its position,
 * so a list holding only the middle slice is a caller disagreeing with the
 * slicer. Prepared documents are sliced whole too, which is what makes this the
 * faithful fixture rather than the convenient one.
 *
 * @returns Three pairs covering the archive end to end
 *
 * @example
 * ```ts
 * const slices = documentSlices();
 * ```
 */
function documentSlices(): readonly ChunkPair[] {
  return [
    pairOver({
      target: {
        sliceIndex: 0,
        nodes: [],
        startOffset: 0,
        endOffset: MIDDLE_START,
        text: OPENING,
      },
    },),
    pairOver({
      target: {
        sliceIndex: 1,
        nodes: [],
        startOffset: MIDDLE_START,
        endOffset: MIDDLE_END,
        text: ARCHIVE_MIDDLE,
      },
    },),
    pairOver({
      target: {
        sliceIndex: 2,
        nodes: [],
        startOffset: MIDDLE_END,
        endOffset: ARCHIVE.length,
        text: CLOSING,
      },
    },),
  ];
}

/**
 * Builds a document whose middle section the archive never translated.
 *
 * THE SECOND SLICE IS A ZERO-WIDTH PLACE at the boundary rather than a span
 * over wording, which is what a preparation produces where a source section has
 * no translation to pair with. The archive's own middle paragraph is left
 * unsliced, so a rendering written here lands AHEAD of it rather than over it.
 *
 * @returns Two pairs, the second of them a place rather than wording
 *
 * @example
 * ```ts
 * const slices = documentSlicesWithAGap();
 * ```
 */
function documentSlicesWithAGap(): readonly ChunkPair[] {
  return [
    pairOver({
      target: {
        sliceIndex: 0,
        nodes: [],
        startOffset: 0,
        endOffset: MIDDLE_START,
        text: OPENING,
      },
    },),
    pairOver({
      target: {
        kind: 'insertion',
        sliceIndex: 1,
        nodes: [],
        startOffset: MIDDLE_START,
        endOffset: MIDDLE_START,
        text: '',
      },
    },),
  ];
}

/**
 * Builds an artifact whose one slice reads as the wording given.
 *
 * GOES THROUGH THE CONTEST rather than the consolidation, because the contest
 * is the shortest path to a chosen wording and this file is about what happens
 * AFTER a decider spoke, not about which decider spoke. Whether each stage is
 * read correctly is `would-ship-text.unit.test.ts`.
 *
 * @param translateText - wording the translate lane offered and the contest picked
 *
 * @param incumbentKind - whether the archive holds wording at this slice
 *
 * @returns Artifact the publisher reads
 *
 * @example
 * ```ts
 * const artifact = artifactShipping({ translateText: DECIDED_MIDDLE, },);
 * ```
 */
function artifactShipping(
  {
    translateText,
    incumbentKind = 'present',
  }: {
    readonly translateText: string;
    readonly incumbentKind?: 'present' | 'absent';
  },
): WouldShipSource {
  return {
    comparison: [
      {
        sliceIndex: 1,
        incumbentKind,
        incumbentText: (incumbentKind === 'present') ? ARCHIVE_MIDDLE : '',
        repairText: ARCHIVE_MIDDLE,
        translateText,
        laneRelation: 'both-differ',
        repairOutcome: {
          kind: 'decided',
          acceptedText: ARCHIVE_MIDDLE,
        },
        translateOutcome: {
          kind: 'decided',
          acceptedText: translateText,
        },
        decisionComparison: {
          kind: 'comparable',
          verdict: 'different',
        },
        repairDelivery: { kind: 'replacement-shipped', },
        translateDelivery: { kind: 'replacement-shipped', },
      },
    ],
    consolidation: { kind: 'not-run', },
    laneSelection: {
      kind: 'contested',
      slices: [
        {
          sliceIndex: 1,
          verdict: {
            kind: 'lane-won',
            lane: 'translate',
          },
          ballots: [],
          usable: 3,
        },
      ],
    },
  } as unknown as WouldShipSource;
}

/**
 * Builds an artifact whose one slice is an ANCHOR nobody filled.
 *
 * REACHES THE SILENCE THROUGH A DECLINED CONTEST OVER AN ARCHIVE THAT HOLDS
 * NOTHING. `XIEPT2` reached exactly this state live: its translate lane backed
 * no candidate at slice 12 and recorded the slice unfilled, which left the
 * contest two blank lanes to choose between and no archive wording to fall back
 * on.
 *
 * @returns Artifact whose one slice is an unfilled anchor
 *
 * @example
 * ```ts
 * const artifact = artifactWithAnUnfilledAnchor();
 * ```
 */
function artifactWithAnUnfilledAnchor(): WouldShipSource {
  return {
    comparison: [
      {
        sliceIndex: 1,
        incumbentKind: 'absent',
        incumbentText: '',
        repairText: '',
        translateText: '',
        laneRelation: 'both-differ',
        repairOutcome: { kind: 'unfilled', },
        translateOutcome: { kind: 'unfilled', },
        decisionComparison: {
          kind: 'comparable',
          verdict: 'same',
        },
        repairDelivery: { kind: 'gap-remains', },
        translateDelivery: { kind: 'gap-remains', },
      },
    ],
    consolidation: { kind: 'not-run', },
    laneSelection: {
      kind: 'contested',
      slices: [
        {
          sliceIndex: 1,
          verdict: { kind: 'settled-neither', },
          ballots: [],
          usable: 3,
        },
      ],
    },
  } as unknown as WouldShipSource;
}

/**
 * Throwaway tree root for one case.
 *
 * @returns Root nothing outside the case writes into, plus how to remove it
 *
 * @example
 * ```ts
 * await using tree = await throwawayTree();
 * ```
 */
async function throwawayTree(): Promise<{ readonly publishDir: string; } & AsyncDisposable> {
  /**
   * Directory this case owns.
   */
  const publishDir = await mkdtemp(join(
    tmpdir(),
    'publish-fixed-',
  ),);

  return {
    publishDir,
    [Symbol.asyncDispose]: async () => {
      await rm(
        publishDir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Characters the disagreeing fixture claims the archive holds beyond what it
 * does, chosen large enough to be unambiguous and small enough to be a
 * plausible drift rather than a rewrite.
 */
const OVERSTATED_BY = 5;

/**
 * Builds an artifact whose comparison row claims MORE archive wording at the
 * slice than the archive actually holds there.
 *
 * MODELS THE `#194` CLASS RATHER THAN A TYPO: an artifact and the publisher
 * disagreeing about what a slice covers is exactly the state that cost XIEPT2
 * four hours and forty-eight minutes, and it is invisible to every check that
 * reads only one of the two. The wording still ships and still lands in order,
 * so the occurrence scan passes and only the arithmetic notices.
 *
 * @returns Artifact that disagrees with the archive the publisher splices
 *
 * @example
 * ```ts
 * const artifact = artifactOverstatingTheArchive();
 * ```
 */
function artifactOverstatingTheArchive(): WouldShipSource {
  /**
   * The honest fixture, whose one row is then overstated.
   */
  const honest = artifactShipping({ translateText: DECIDED_MIDDLE, },) as unknown as {
    readonly comparison: readonly Record<string, unknown>[];
  };

  return {
    ...honest,
    comparison: honest.comparison
      .map(function overstate(row,): Record<string, unknown> {
        return {
          ...row,
          incumbentText: `${ARCHIVE_MIDDLE}${'x'.repeat(OVERSTATED_BY,)}`,
        };
      },),
  } as unknown as WouldShipSource;
}

/**
 * Publishes one entry and reads back what landed.
 *
 * @param artifact - settled entry to publish
 *
 * @param publishDir - tree root to write into
 *
 * @param slices - pairs the entry was prepared into
 *
 * @returns Path written and the bytes at it
 *
 * @example
 * ```ts
 * const { text, } = await publishAndRead({ artifact, publishDir, },);
 * ```
 */
async function publishAndRead(
  {
    artifact,
    publishDir,
    slices = documentSlices(),
    sourceText = SOURCE_PAGE,
  }: {
    readonly artifact: WouldShipSource;
    readonly publishDir: string;
    readonly slices?: readonly ChunkPair[];
    readonly sourceText?: string;
  },
): Promise<{ readonly path: string; readonly text: string; readonly destinations: DestinationCheck; }> {
  /**
   * Where the publisher put it, and what the page carries of the source's links.
   */
  const {
    path,
    destinations,
  } = await publishFixedPage({
    artifact,
    slices,
    archiveText: ARCHIVE,
    sourceText,
    entryId: 'BookshopCat',
    publishDir,
    metadataStanding: { kind: 'judged-keep', voteWeight: 3, },
    l: tagged({ tag: 'publish-test', },),
  },);

  return {
    path,
    text: await readFile(
      path,
      'utf8',
    ),
    destinations,
  };
}

//endregion Fixtures

await describe({
  name: publishFixedPage.name,
  children: [
    it({
      name:
        'WRITES THE DECIDED WORDING INTO THE SLICE IT NAMES AND NOWHERE ELSE, leaving the paragraphs '
        + 'either side byte for byte as the archive had them. A publisher that rebuilt the document '
        + 'from the pieces it knew about would pass an assertion about the replaced slice alone while '
        + 'quietly dropping everything no decider mentioned',
      fn: async () => {
        await using tree = await throwawayTree();

        const { text, } = await publishAndRead({
          artifact: artifactShipping({ translateText: DECIDED_MIDDLE, },),
          publishDir: tree.publishDir,
        },);

        expect(text,).toBe(`${OPENING}${DECIDED_MIDDLE}${CLOSING}`,);
        expect(text.startsWith(OPENING,),).toBe(true,);
        expect(text.endsWith(CLOSING,),).toBe(true,);
      },
    },),

    it({
      name:
        'REPUBLISHES AN ENTRY NO DECIDER CHANGED BYTE FOR BYTE, trailing newline included. The fixed '
        + 'version of an unchanged page IS the page, which is what makes the tree a drop-in set rather '
        + 'than a patch; it is also the only assertion that catches an assembler that rewrote line '
        + 'endings or trimmed an ending nobody asked it to touch',
      fn: async () => {
        await using tree = await throwawayTree();

        const { text, } = await publishAndRead({
          artifact: artifactShipping({ translateText: ARCHIVE_MIDDLE, },),
          publishDir: tree.publishDir,
        },);

        expect(text,).toBe(ARCHIVE,);
        expect(text.endsWith('\n',),).toBe(true,);
        expect(text.endsWith('\n\n',),).toBe(false,);
      },
    },),

    it({
      name:
        'CREATES EVERY DIRECTORY ON THE WAY DOWN, since the tree root is made once per pass and the '
        + 'two levels under it are per entry. Without this the first entry of every run fails on a '
        + 'missing parent, which is a failure that looks like a broken document rather than a missing '
        + 'directory',
      fn: async () => {
        await using tree = await throwawayTree();

        const { path, } = await publishAndRead({
          artifact: artifactShipping({ translateText: DECIDED_MIDDLE, },),
          publishDir: tree.publishDir,
        },);

        expect(path,).toBe(join(
          tree.publishDir,
          'people',
          'BookshopCat',
          'page.en.md',
        ),);
      },
    },),

    it({
      name:
        'OVERWRITES A PAGE ALREADY SITTING THERE, which is what a resumed pass does to every entry it '
        + 'settles again. Refusing would make the second run of any interrupted pass fail on its own '
        + 'output, and skipping would leave a page from an older pipeline claiming to be this run\'s',
      fn: async () => {
        await using tree = await throwawayTree();

        const path = fixedPagePath({
          publishDir: tree.publishDir,
          entryId: 'BookshopCat',
        },);
        await rm(
          path,
          { force: true, },
        );

        const first = await publishAndRead({
          artifact: artifactShipping({ translateText: 'stale wording from an earlier pipeline\n', },),
          publishDir: tree.publishDir,
        },);
        expect(first.text.includes('stale wording',),).toBe(true,);

        const second = await publishAndRead({
          artifact: artifactShipping({ translateText: DECIDED_MIDDLE, },),
          publishDir: tree.publishDir,
        },);
        expect(second.text,).toBe(`${OPENING}${DECIDED_MIDDLE}${CLOSING}`,);
        expect(second.text.includes('stale wording',),).toBe(false,);
      },
    },),

    it({
      name:
        'FILLS A PASSAGE THE ARCHIVE NEVER TRANSLATED, writing into the zero-width place the '
        + 'preparation left for it. This is the case that cannot be assembled from the artifact alone: '
        + 'an absent incumbent is the empty string, which matches at every offset, so only the stored '
        + 'span can say where the rendering goes',
      fn: async () => {
        await using tree = await throwawayTree();

        const { text, } = await publishAndRead({
          artifact: artifactShipping({
            translateText: DECIDED_MIDDLE,
            incumbentKind: 'absent',
          },),
          publishDir: tree.publishDir,
          slices: documentSlicesWithAGap(),
        },);

        // Written INTO the gap rather than over the paragraph after it: the
        // archive's own middle paragraph is still there, with the filled
        // passage ahead of it.
        expect(text,).toBe(`${OPENING}${DECIDED_MIDDLE}${ARCHIVE_MIDDLE}${CLOSING}`,);
      },
    },),

    it({
      name:
        'PUBLISHES AN ENTRY WHOSE DECIDERS LEFT AN ANCHOR UNFILLED, leaving the gap exactly as the '
        + 'archive had it. It used to refuse, on the argument that a half-document is worse than a '
        + 'failed entry because only the failure gets retried. `XIEPT2` settled that: the refusal '
        + 'landed after four hours and forty-eight minutes of calls, kept neither page nor artifact, '
        + 'and a retry meets the same passage and the same judges. The archive already carries this '
        + 'gap, so the page loses nothing that was ever there and keeps every slice the run did buy',
      fn: async () => {
        await using tree = await throwawayTree();

        /**
         * Page the publisher wrote over an archive with an unfilled anchor in it.
         */
        const published = await publishAndRead({
          artifact: artifactWithAnUnfilledAnchor(),
          publishDir: tree.publishDir,
          slices: documentSlicesWithAGap(),
        },);

        expect(published.text,).toBe(ARCHIVE,);
      },
    },),

    it({
      name:
        'STILL LEAVES THE SPLICE FREE TO REFUSE A BLANK RENDERING AT AN ANCHOR, which is the guard '
        + 'that caught this and is not being weakened. What changed is upstream of it: a slice '
        + 'deliberately left unfilled no longer presents itself as a rendering of blank text, so the '
        + 'guard now only ever sees a caller that really did claim one',
      fn: async () => {
        /**
         * What the splice refused when handed the row this publisher no longer
         * emits, held so the class and the wording can both be asserted.
         */
        const refusalOfWritingNothingAtAnAnchor = async (): Promise<string> => spliceSlices({
          targetText: ARCHIVE,
          slices: documentSlicesWithAGap(),
          replacements: [
            {
              sliceIndex: 1,
              replacementText: '',
            },
          ],
        },);

        await expect(refusalOfWritingNothingAtAnAnchor(),).rejects.toBeInstanceOf(SliceSpliceError,);
        await expect(refusalOfWritingNothingAtAnAnchor(),).rejects.toThrow(
          'has no translation and writes none',
        );
      },
    },),

    it({
      name: 'REFUSES TARGET CONTRIBUTOR RENAMING before writing page',
      fn: async () => {
        await using tree = await throwawayTree();
        /**
         * Existing English attribution establishing chosen public handle.
         */
        const contributorArchive = 'Contributors for this entry: [Snow](https://example.test/snow)\n';
        /**
         * Candidate literally respelling contributor while retaining destination.
         */
        const renamed = 'Contributors for this entry: [Snowflake](https://example.test/snow)\n';
        /**
         * Baseline artifact shape reused with single whole-page attribution slice.
         */
        const baseline = artifactShipping({ translateText: renamed, });
        /**
         * Comparison row adapted to attribution fixture.
         */
        const [baselineRow,] = baseline.comparison;
        if (baselineRow === undefined)
          throw new Error('publisher fixture has no comparison row',);
        const artifact = {
          ...baseline,
          comparison: [{
            ...baselineRow,
            sliceIndex: 0,
            incumbentText: contributorArchive,
            repairText: contributorArchive,
            translateText: renamed,
            repairOutcome: {
              kind: 'decided',
              acceptedText: contributorArchive,
            },
            translateOutcome: {
              kind: 'decided',
              acceptedText: renamed,
            },
          },],
          laneSelection: {
            kind: 'contested',
            slices: [{
              sliceIndex: 0,
              verdict: {
                kind: 'lane-won',
                lane: 'translate',
              },
              ballots: [],
              usable: 0,
            },],
          },
        } as WouldShipSource;
        /**
         * Publication attempt that must fail before atomic write.
         */
        const refused = publishFixedPage({
          artifact,
          slices: [pairOver({
            target: {
              sliceIndex: 0,
              nodes: [],
              startOffset: 0,
              endOffset: contributorArchive.length,
              text: contributorArchive,
            },
          },),],
          archiveText: contributorArchive,
          sourceText: '条目贡献：小雪\n',
          entryId: 'BookshopContributors',
          publishDir: tree.publishDir,
          metadataStanding: { kind: 'judged-keep', voteWeight: 3, },
          l: tagged({ tag: 'publish-test', },),
        },);
        await expect(refused,).rejects.toBeInstanceOf(ContributorCompletenessError,);
        /**
         * Path contributor-invalid page must never reach.
         */
        const refusedPath = fixedPagePath({
          publishDir: tree.publishDir,
          entryId: 'BookshopContributors',
        },);
        expect(existsSync(refusedPath,),).toBe(false,);
      },
    },),

    it({
      name:
        'REFUSES A READING NAMING A SLICE THE PREPARATION NEVER PRODUCED, instead of writing the page '
        + 'without it. The two sides are stamped by different stages, and `#99` is the record of what '
        + 'index disagreement costs: silently dropping the reading would publish archive wording at a '
        + 'slice the deciders replaced',
      fn: async () => {
        await using tree = await throwawayTree();

        /**
         * What publishAndRead refused with, held so the class and the wording
         * can both be asserted: `.rejects` awaits afresh on every matcher call,
         * so one promise serves two assertions and no capture helper is needed.
         */
        const refusalOfPublishingPastTheSlices = publishAndRead({
          artifact: artifactShipping({ translateText: DECIDED_MIDDLE, },),
          publishDir: tree.publishDir,
          slices: [documentSlices()[0] as ChunkPair,],
        },);

        await expect(refusalOfPublishingPastTheSlices,).rejects.toBeInstanceOf(SliceSpliceError,);
        await expect(refusalOfPublishingPastTheSlices,).rejects.toThrow('no slice 1 to write into',);
      },
    },),
  ],
},);

await describe({
  name: `${publishFixedPage.name} refuses a page that disagrees with its artifact`,
  children: [
    it({
      name:
        'WRITES NOTHING AT ALL when the artifact and the archive disagree about what a slice covers, '
        + 'rather than publishing a page no artifact accounts for. The refusal has to happen before '
        + 'the write: `pass-entry.ts` publishes BEFORE it settles precisely so that an artifact '
        + 'existing means a page exists, and a page written then refused would invert that',
      fn: async () => {
        await using tree = await throwawayTree();

        /**
         * Where this case would have published.
         */
        const { publishDir, } = tree;

        /**
         * Whatever the publisher raised, caught so its class can be checked.
         */
        const refusal = await (async (): Promise<unknown> => {
          try {
            await publishFixedPage({
              artifact: artifactOverstatingTheArchive(),
              slices: documentSlices(),
              archiveText: ARCHIVE,
              sourceText: SOURCE_PAGE,
              entryId: 'BookshopCat',
              publishDir,
              metadataStanding: { kind: 'judged-keep', voteWeight: 3, },
              l: tagged({ tag: 'publish-test', },),
            },);
            return undefined;
          } catch (error) {
            return error;
          }
        })();

        expect(refusal,).toBeInstanceOf(PublishedPageDisagreesError,);

        // NOTHING ON DISK, which is the half a reader of the throw alone would
        // not learn. A guard that raised after `writeFileAtomic` would satisfy
        // the assertion above and still leave the page behind.
        /**
         * Where the page would have landed had the guard let it through.
         */
        const wouldBeAt = fixedPagePath({
          publishDir,
          entryId: 'BookshopCat',
        },);

        expect(existsSync(wouldBeAt,),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: `${publishFixedPage.name} destinations`,
  children: [
    it({
      name: 'PAUSES source destination loss before writing page',
      fn: async () => {
        await using tree = await throwawayTree();
        const path = fixedPagePath({
          publishDir: tree.publishDir,
          entryId: 'BookshopCat',
        },);
        let thrown: unknown;
        try {
          await publishFixedPage({
            artifact: artifactShipping({ translateText: DECIDED_MIDDLE, },),
            slices: documentSlices(),
            archiveText: ARCHIVE,
            sourceText: `${SOURCE_PAGE}\n她的主页：https://example.org/tabby。\n`,
            entryId: 'BookshopCat',
            publishDir: tree.publishDir,
            metadataStanding: { kind: 'judged-keep', voteWeight: 3, },
            l: tagged({ tag: 'publish-test', },),
          },);
        }
        catch (error) {
          thrown = error;
        }

        expect(thrown,).toBeInstanceOf(DroppedDestinationError,);
        expect((thrown as DroppedDestinationError).droppedCount,).toBe(1);
        expect(existsSync(path,),).toBe(false,);
      },
    },),

    it({
      name: 'reports nothing dropped for a source that links nowhere, which is the control',
      fn: async () => {
        await using tree = await throwawayTree();

        /**
         * Page published from the linkless source page.
         */
        const published = await publishAndRead({
          artifact: artifactShipping({ translateText: DECIDED_MIDDLE, },),
          publishDir: tree.publishDir,
        },);

        expect(published.destinations,).toStrictEqual({
          source: [],
          page: [],
          dropped: [],
          findings: [],
        },);
      },
    },),
  ],
},);
