/**
 * Tests for the settled rendering audit's driver: what it buys, in what
 * order, what it prints before buying, and what one audited row carries.
 *
 * NO CASE REACHED THESE BEFORE. `capped` already carried one real cap defect
 * (the args suite's header records it), `printPopulation` is the free reading
 * a run prints before any roster is woken, and `auditOne` is where a subject's
 * provenance and the roster's answers become the row every later reading
 * interprets. Each is exported through the barrel for exactly this.
 *
 * THE CLIENT IS HANDED IN, which is the rendering-6 shape: `main` builds one
 * per run and `auditOne` counts every subject into it, so a scripted client
 * here sees every model the roster asks and answers each with silence. The
 * roster is the production one, read from the run configuration, so the
 * cases assert against what the client was asked rather than against a list
 * copied here.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  auditOne,
  capped,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  eligibleSubjects,
  printPopulation,
  type SettledArtifactReading,
  type SettledAuditSubject,
  type SettledIdentity,
  type SettledVerification,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 * Original every subject carries.
 */
const SOURCE_TEXT = '三只猫住在书店的阁楼里。她们不吃罐头，每天傍晚只喝一碗温牛奶。';

/**
 * Rendering every subject carries.
 */
const CANDIDATE_TEXT = 'Three cats live in the attic of the bookshop. They do not eat canned '
  + 'food, and every evening they drink one bowl of warm milk.';

/**
 * Run set every fixture belongs to.
 */
const RUN_SET = 'naptime-20260825';

/**
 * Built pipeline every fixture records.
 */
const DIGEST = 'sha256-tree-v1:cafef00d';

/**
 * Characters in a SHA-1 object id.
 */
const OBJECT_ID_LENGTH = 40;

/**
 * Corpus commit every fixture records.
 */
const CORPUS_SHA = 'b'.repeat(OBJECT_ID_LENGTH,);

/**
 * Cap meaning every subject, as the args module spells it internally.
 */
const EVERY_SUBJECT = -1;

/**
 * Cap that buys a prefix.
 */
const SMALL_BUY = 2;

/**
 * Declared identity a producing run had, in the shape the subject carries.
 */
const IDENTITY_CONTEXT = 'Mittens is written Mao Mao on the Chinese side';

/**
 * Builds one audit subject.
 *
 * @param entryId - corpus entry
 *
 * @param sliceIndex - slice index
 *
 * @param auditsArchiveText - whether it audits the archive's own English
 *
 * @param identity - what the producing run declared, none unless a case says
 *
 * @returns Subject as the input module offers one
 *
 * @example
 * ```ts
 * const subject = subjectAt({ entryId: 'mittens', sliceIndex: 0, auditsArchiveText: false, },);
 * ```
 */
function subjectAt(
  {
    entryId,
    sliceIndex,
    auditsArchiveText,
    identity = { kind: 'none', },
  }: {
    readonly entryId: string;
    readonly sliceIndex: number;
    readonly auditsArchiveText: boolean;
    readonly identity?: SettledIdentity;
  },
): SettledAuditSubject {
  return {
    runSet: RUN_SET,
    entryId,
    artifactDigest: DIGEST,
    corpusSha: CORPUS_SHA,
    sliceIndex,
    deliveryKind: auditsArchiveText ? 'incumbent-retained' : 'replacement-shipped',
    auditsArchiveText,
    sourceText: SOURCE_TEXT,
    candidateText: CANDIDATE_TEXT,
    pageRelation: { kind: 'survives', },
    identity,
  };
}

/**
 * Builds one artifact reading.
 *
 * @param entryId - corpus entry
 *
 * @param subjects - slices it offers
 *
 * @param verification - provenance answer, verified unless a case says
 *
 * @returns Reading as the input module returns one
 *
 * @example
 * ```ts
 * const reading = readingOf({ entryId: 'mittens', subjects, },);
 * ```
 */
function readingOf(
  {
    entryId,
    subjects,
    verification = { kind: 'verified', },
  }: {
    readonly entryId: string;
    readonly subjects: readonly SettledAuditSubject[];
    readonly verification?: SettledVerification;
  },
): SettledArtifactReading {
  return {
    runSet: RUN_SET,
    artifactFile: `${entryId}.json`,
    entryId,
    artifactDigest: DIGEST,
    verification,
    subjects,
  };
}

/**
 * Two subjects of one entry, one archive and one fresh.
 */
const MITTENS = [
  subjectAt({
    entryId: 'mittens',
    sliceIndex: 0,
    auditsArchiveText: true,
  },),
  subjectAt({
    entryId: 'mittens',
    sliceIndex: 1,
    auditsArchiveText: false,
  },),
];

/**
 * One subject of a second entry.
 */
const TABBY = [subjectAt({
  entryId: 'tabby',
  sliceIndex: 0,
  auditsArchiveText: false,
},),];

/**
 * Captures what is printed, forwarding every line onward so the runner and a
 * concurrent case still see their own; the describe using it runs one case
 * at a time regardless.
 *
 * @param lines - where captured lines go
 *
 * @returns Captured lines, disposable
 *
 * @example
 * ```ts
 * using printed = collectingLines({ lines: [], },);
 * ```
 */
function collectingLines(
  { lines, }: { readonly lines: string[]; },
): { readonly lines: readonly string[]; } & Disposable {
  /**
   * Reporter found on entry, which every line is forwarded to.
   */
  const previous = console.log;

  /**
   * Whether this capture is still recording.
   */
  const recording = { open: true, };

  /**
   * This capture's own wrapper.
   */
  const mine = (...parts: readonly unknown[]): void => {
    if (recording.open) {
      lines.push(parts.map(String,)
        .join(' ',),);
    }
    previous(...parts,);
  };
  console.log = mine;
  return {
    lines,
    [Symbol.dispose]: () => {
      recording.open = false;
      if (console.log === mine)
        console.log = previous;
    },
  };
}

/**
 * Client answering every auditor with silence and recording who was asked
 * and what it was shown.
 *
 * @param asked - model ids, one per call, appended as calls arrive
 *
 * @param shown - every request's messages as JSON, appended as calls arrive
 *
 * @returns Client the driver calls
 *
 * @example
 * ```ts
 * const client = quietClient({ asked: [], shown: [], },);
 * ```
 */
function quietClient(
  {
    asked,
    shown,
  }: {
    readonly asked: string[];
    readonly shown: string[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the audit',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      asked.push(request.modelId,);
      shown.push(JSON.stringify(request.messages,),);

      /**
       * An auditor that found nothing.
       */
      const quiet: unknown = {
        verdict: 'no-defect-found',
        findings: [],
      };
      if (!request.validate(quiet,))
        throw new Error('scripted payload failed the guard',);

      return {
        kind: 'ok',
        value: quiet,
        rawText: JSON.stringify(quiet,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the audit',);
    },
  };
}

await describe({
  name: capped.name,
  children: [
    it({
      name: 'BUYS EVERY SUBJECT under the every-subject sentinel, which is what a run with no '
        + '--cap asks for',
      fn: async () => {
        expect(capped({
          eligible: MITTENS,
          cap: EVERY_SUBJECT,
        },),).toEqual(MITTENS,);
      },
    },),

    it({
      name: 'BUYS NOTHING at zero, which is the wiring check that reads the archive and asks '
        + 'nobody',
      fn: async () => {
        expect(capped({
          eligible: MITTENS,
          cap: 0,
        },),).toEqual([],);
      },
    },),

    it({
      name: 'BUYS THE PREFIX a positive cap allows, in the order the subjects arrived',
      fn: async () => {
        expect(capped({
          eligible: [
            ...MITTENS,
            ...TABBY,
          ],
          cap: SMALL_BUY,
        },),).toEqual(MITTENS,);
      },
    },),
  ],
},);

await describe({
  name: eligibleSubjects.name,
  children: [
    it({
      name: 'OFFERS every subject of every reading, in archive order, when no entry was named',
      fn: async () => {
        expect(eligibleSubjects({
          readings: [
            readingOf({
              entryId: 'mittens',
              subjects: MITTENS,
            },),
            readingOf({
              entryId: 'tabby',
              subjects: TABBY,
            },),
          ],
          onlyIds: [],
        },),).toEqual([
          ...MITTENS,
          ...TABBY,
        ],);
      },
    },),

    it({
      name: 'KEEPS only the named entries, so a capped buy is a fraction of what --only left '
        + 'rather than of the whole archive',
      fn: async () => {
        expect(eligibleSubjects({
          readings: [
            readingOf({
              entryId: 'mittens',
              subjects: MITTENS,
            },),
            readingOf({
              entryId: 'tabby',
              subjects: TABBY,
            },),
          ],
          onlyIds: ['tabby',],
        },),).toEqual(TABBY,);
      },
    },),
  ],
},);

await describe({
  name: printPopulation.name,
  children: [
    it({
      name: 'PRINTS one line per artifact with every count beside its denominator: subjects, '
        + 'retained, replaced, displaced, undecided and the verification',
      fn: async () => {
        using printed = collectingLines({ lines: [], },);

        printPopulation({
          readings: [readingOf({
            entryId: 'mittens',
            subjects: MITTENS,
          },),],
        },);

        expect(printed.lines,).toEqual([
          `${RUN_SET}/mittens.json  subjects=2 retained=1 replaced=1 displaced=0 undecided=0 `
            + 'verification=verified',
        ],);
      },
    },),

    it({
      name: 'SAYS WHAT A REFUSED VERIFICATION OBJECTED TO on its own line, since a slicing that '
        + 'moved under a settled artifact is the loudest thing this free reading can find',
      fn: async () => {
        using printed = collectingLines({ lines: [], },);

        printPopulation({
          readings: [readingOf({
            entryId: 'mittens',
            subjects: MITTENS,
            verification: {
              kind: 'refused',
              detail: 'the slicing moved',
            },
          },),],
        },);

        expect(printed.lines[0]?.endsWith('verification=refused',),).toBe(true,);
        expect(printed.lines[1],).toBe('   REFUSED: the slicing moved',);
      },
    },),

    it({
      name: 'NAMES THE RECIPE HALVES an unverifiable artifact lacks, so a reader can decide '
        + 'whether the gap explains the disagreement',
      fn: async () => {
        using printed = collectingLines({ lines: [], },);

        printPopulation({
          readings: [readingOf({
            entryId: 'mittens',
            subjects: MITTENS,
            verification: {
              kind: 'unverifiable',
              unrecorded: [
                'sectionPairing',
                'blockPairing',
              ],
              detail: 'the rebuild guessed both halves',
            },
          },),],
        },);

        expect(printed.lines[0]?.endsWith('verification=unverifiable',),).toBe(true,);
        expect(printed.lines[1],)
          .toBe('   UNVERIFIABLE (records no sectionPairing, blockPairing): the rebuild guessed both halves',);
      },
    },),
  ],
  concurrency: 1,
},);

await describe({
  name: auditOne.name,
  children: [
    it({
      name: 'BUILDS ONE ROW from the subject\'s provenance and the roster\'s answers, one voice row '
        + 'per model the client was asked, with the texts digested rather than kept',
      fn: async () => {
        /**
         * Who the driver asked, and what it showed them.
         */
        const asked: string[] = [];
        const shown: string[] = [];

        /**
         * The row one quiet roster produces.
         */
        const row = await auditOne({
          subject: subjectAt({
            entryId: 'mittens',
            sliceIndex: 1,
            auditsArchiveText: false,
          },),
          client: quietClient({
            asked,
            shown,
          },),
        },);

        expect(row.runSet,).toBe(RUN_SET,);
        expect(row.entryId,).toBe('mittens',);
        expect(row.sliceIndex,).toBe(1,);
        expect(row.deliveryKind,).toBe('replacement-shipped',);
        expect(row.auditsArchiveText,).toBe(false,);
        expect(row.artifactDigest,).toBe(DIGEST,);
        expect(row.corpusSha,).toBe(CORPUS_SHA,);
        expect(row.identityKind,).toBe('none',);
        expect(row.textIdentity.kind,).toBe('digested',);
        expect(asked.length,).toBeGreaterThan(0,);
        expect(row.report.rows.length,).toBe(new Set(asked,).size,);
        expect(row.report.rows.every(function answered(voice,): boolean {
          return asked.includes(voice.modelId,);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'SHOWS THE ROSTER A DECLARED IDENTITY and withholds an absent one, since an auditor '
        + 'without the names the producing judges had calls a declared name a fabrication',
      fn: async () => {
        /**
         * What the roster was shown with the identity declared.
         */
        const shownDeclared: string[] = [];
        await auditOne({
          subject: subjectAt({
            entryId: 'mittens',
            sliceIndex: 0,
            auditsArchiveText: true,
            identity: {
              kind: 'declared',
              context: IDENTITY_CONTEXT,
            },
          },),
          client: quietClient({
            asked: [],
            shown: shownDeclared,
          },),
        },);

        /**
         * What it was shown with none.
         */
        const shownNone: string[] = [];
        await auditOne({
          subject: subjectAt({
            entryId: 'mittens',
            sliceIndex: 0,
            auditsArchiveText: true,
          },),
          client: quietClient({
            asked: [],
            shown: shownNone,
          },),
        },);

        expect(shownDeclared.join('\n',)
          .includes(IDENTITY_CONTEXT,),).toBe(true,);
        expect(shownNone.join('\n',)
          .includes(IDENTITY_CONTEXT,),).toBe(false,);
      },
    },),
  ],
},);
