import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { runRenderingAudit, } from '../rendering-audit.ts';
import { RenderingAuditInvariantError, } from '../rendering-audit-invariant.ts';
import type { PassReferenceReader, } from './pass-outside-reads.ts';
import { digestAuditedText, } from './rendering-audit-settled-digest.ts';
import type { SettledArtifactReading, } from './rendering-audit-settled-input.ts';
import {
  type SettledAuditRow,
  SETTLED_AUDIT_PROBE,
} from './rendering-audit-settled-row.ts';
import type { SettledAuditSubject, } from './rendering-audit-settled-subject.ts';
import {
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Settled audit buying
// What the settled rendering audit buys, in what order, what it prints before
// buying, and what one bought subject becomes.
//
// SPLIT OUT OF THE ENTRY so the built bundle can export these for its tests.
// An entry module runs its `main` under `import.meta.main`, and a module the
// barrel imports stops being an entry: the bundler folds it into a shared
// chunk, the entry file becomes a re-export of that chunk, and the guard inside
// the chunk reads false, so the command prints nothing and exits 0. Both
// settled-audit commands did exactly that for the length of one commit
// (`744890056`), which the boundary cases in
// `rendering-audit-settled-report.unit.test.ts` now catch. Nothing an entry
// module declares may be exported through a barrel; it moves here instead.

/**
 Audits one slice and keeps what the roster said, whole.
 
 Exported through the barrel so the built bundle's tests can hand it a
 scripted client; `main` is its only caller.
 
 @internal
 
 @param subject - slice under audit, with the identity its producing run had
 
 @param references - what the pages its original links say, as
 `withCitedReferences` read them, empty where the original links nowhere;
 required so no caller audits without having asked
 
 @param client - roster client, built once per run by the caller so every
 subject counts into one seat tally
 
 @returns One row: provenance, plus the report uninterpreted
 
 @example
 ```ts
 const row = await auditOne({ subject, references, client, },);
 ```
 */
export async function auditOne(
  {
    subject,
    references,
    client,
  }: {
    readonly subject: SettledAuditSubject;
    readonly references: string;
    readonly client: SyntheticClient;
  },
): Promise<SettledAuditRow> {
  /**
   Logger tagged for this slice, so a long run's stream says where it is.
   */
  const l = tagged({ tag: `${SETTLED_AUDIT_PROBE}:${subject.entryId}:${String(subject.sliceIndex,)}`, },);

  /**
   Everything the reader put in front of the audit for this slice.
   */
  const {
    runSet,
    entryId,
    sliceIndex,
    deliveryKind,
    auditsArchiveText,
    pageRelation,
    artifactDigest,
    corpusSha,
    sourceText,
    candidateText,
    identity,
  } = subject;

  /**
   What the roster said about this rendering.
   
   The identity block goes in when the pair declared one: the producing judges
   had it, and an auditor without it has every reason to call a declared name
   a fabrication. The references go in for the same reason (ledger B29):
   the producing critics and panels read them, and an auditor without them
   calls a detail a cited page states an unsupported addition.
   */
  const report = await runRenderingAudit({
    client,
    subject: {
      sourceText,
      candidateText,
      ...((identity.kind === 'declared') ? { identityContext: identity.context, } : {}),
      ...((references === '') ? {} : { referenceContext: references, }),
    },
    modelIds: RUN_MODELS.checkerModelIds,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  return {
    runSet,
    entryId,
    sliceIndex,
    deliveryKind,
    auditsArchiveText,
    pageRelation,
    artifactDigest,
    corpusSha,
    identityKind: identity.kind,
    referencesKind: (references === '') ? 'none' : 'cited',
    // Digested rather than kept, so a run file can say whether two rows saw one
    // text without carrying licensed material into a file that gets quoted.
    textIdentity: digestAuditedText({
      sourceText,
      candidateText,
      referenceContext: references,
    },),
    report,
  };
}

/**
 One bought subject beside what the pages its original links say.
 
 @example
 ```ts
 const pair: CitedSubject = { subject, references: '', };
 ```
 */
export type CitedSubject = {
  /**
   Slice to audit.
   */
  readonly subject: SettledAuditSubject;

  /**
   What its page cites, empty where the page links nowhere or nothing
   could be read.
   */
  readonly references: string;
};

/**
 Reads what the pages each bought subject's original links say, once per
 page, and pairs every subject with its own page's.
 
 ONCE PER PAGE rather than once per subject: every slice of one page shares
 one original, so a second read could only cost a fetch or disagree with
 the first. Pages are keyed by their whole text, since two artifacts of one
 entry read at different commits may carry different originals.
 
 ONLY WHAT IS BOUGHT, so the wiring check that buys nothing reads nothing
 and spends nothing. The reader is required rather than defaulted to the
 run's, because a unit test that forgot it would read the environment's
 key and buy a real web read (ledger X19).
 
 Exported through the barrel for the built bundle's tests; `main` is its
 only caller.
 
 @internal
 
 @param subjects - subjects the run will buy, in buying order
 
 @param reader - reads what one original's linked pages say
 
 @returns Every subject with its page's references, in buying order
 
 @example
 ```ts
 const cited = await withCitedReferences({ subjects: buying, reader: RUN_OUTSIDE_READS.references, },);
 ```
 */
export async function withCitedReferences(
  {
    subjects,
    reader,
  }: {
    readonly subjects: readonly SettledAuditSubject[];
    readonly reader: PassReferenceReader;
  },
): Promise<readonly CitedSubject[]> {
  /**
   Logger for the reads, so a run's stream says what each page cited.
   */
  const l = tagged({ tag: `${SETTLED_AUDIT_PROBE}:${withCitedReferences.name}`, },);

  /**
   Each distinct page once, in the order it is first bought.
   */
  const pages = [
    ...new Map(
      subjects.map(function byPage(subject,): readonly [
        string,
        string,
      ] {
        return [
          subject.pageSourceText,
          subject.entryId,
        ];
      },),
    ),
  ];

  /**
   Every page beside what it cites, read concurrently: pages are few, one
   per bought artifact at most.
   */
  const readPages = await Promise.all(pages.map(
    async function readPage([
      pageSourceText,
      entryId,
    ],): Promise<readonly [
      string,
      string,
    ]> {
      /**
       What this page's links say, empty where there are none.
       */
      const references = await reader({
        sourceText: pageSourceText,
        signal: new AbortController().signal,
        l,
      },);
      l.info(
        `CITED REFERENCES entry=${entryId} ${
          (references === '') ? 'none: the page links nowhere or nothing could be read' : `characters=${String(references.length,)}`
        }`,
      );
      return [
        pageSourceText,
        references,
      ];
    },
  ),);

  /**
   What each page cites, by its whole text.
   */
  const cited = new Map(readPages,);

  return subjects.map(function paired(subject,): CitedSubject {
    /**
     What this subject's page cites.
     */
    const references = cited.get(subject.pageSourceText,);

    // Every page was read out of these same subjects, so a miss is a
    // defect here and never a page that cites nothing.
    if (references === undefined)
      throw new RenderingAuditInvariantError({
        invariant: `${subject.entryId} slice ${
          String(subject.sliceIndex,)
        } was bought and its page was never read for references`,
      },);
    return {
      subject,
      references,
    };
  },);
}

/**
 Every subject a run could buy, after the entry filter, in archive order.
 
 SEPARATE FROM THE CAP so the fraction a capped run reports is over what was
 SELECTABLE rather than over the whole archive. Reporting `5 of 40` where
 `--only` left 30 selectable overstates what was skipped and understates the
 coverage bought, and the line alone gives a reader no way to tell.
 
 Exported through the barrel for the built bundle's tests; `main` is its
 only caller.
 
 @internal
 
 @param readings - every artifact the archive holds
 
 @param onlyIds - entries to keep, empty for all
 
 @returns Subjects the filter left
 
 @example
 ```ts
 const eligible = eligibleSubjects({ readings, onlyIds, },);
 ```
 */
export function eligibleSubjects(
  {
    readings,
    onlyIds,
  }: {
    readonly readings: readonly SettledArtifactReading[];
    readonly onlyIds: readonly string[];
  },
): readonly SettledAuditSubject[] {
  return readings
    .flatMap(function subjectsOf(reading,): readonly SettledAuditSubject[] {
      return reading.subjects;
    },)
    .filter(function isWanted(subject,): boolean {
      if (onlyIds.length === 0)
        return true;
      return onlyIds.includes(subject.entryId,);
    },);
}

/**
 Takes the prefix a cap allows.
 
 Exported through the barrel for the built bundle's tests; `main` is its
 only caller. A negative cap reaches here only as the args module's own
 "every subject" sentinel, since `readCap` refuses a typed one.
 
 @internal
 
 @param eligible - subjects the filter left, in a stable order
 
 @param cap - how many to buy, negative for all
 
 @returns Subjects to audit
 
 @example
 ```ts
 const buying = capped({ eligible, cap, },);
 ```
 */
export function capped(
  {
    eligible,
    cap,
  }: {
    readonly eligible: readonly SettledAuditSubject[];
    readonly cap: number;
  },
): readonly SettledAuditSubject[] {
  if (cap < 0)
    return eligible;
  return eligible.slice(
    0,
    cap,
  );
}

/**
 Reports what the archive holds, before anything is bought.
 
 Exported through the barrel for the built bundle's tests; `main` is its
 only caller.
 
 @internal
 
 @param readings - every artifact the archive holds
 
 @example
 ```ts
 printPopulation({ readings, },);
 ```
 */
export function printPopulation(
  { readings, }: { readonly readings: readonly SettledArtifactReading[]; },
): void {
  readings.forEach(function describe(reading,): void {
    /**
     Where this artifact came from, what it offers, and whether its recorded
     slicing still describes the pair.
     */
    const {
      runSet,
      artifactFile,
      subjects,
      verification,
    } = reading;

    /**
     Slices whose text is the archive's own wording.
     */
    const retained = subjects.filter(function isArchive(subject,): boolean {
      return subject.auditsArchiveText;
    },);

    /**
     Slices a later stage overruled, so the audit will read wording no
     reader of an assembled document would meet.
     
     PRINTED HERE because this whole reading is free, and knowing it before
     a roster is woken up is the reason this module is separate from the
     driver that spends quota.
     */
    const displaced = subjects.filter(function wasOverruled(subject,): boolean {
      /**
       How this subject relates to what a document would carry.
       */
      const { pageRelation, } = subject;
      return pageRelation.kind === 'displaced';
    },);

    /**
     Slices no stage has decided at all, which is the absence of a decision
     rather than one: the artifact records it as pending a human decision.
     */
    const undecided = subjects.filter(function wasNeverAsked(subject,): boolean {
      /**
       How this subject relates to what a document would carry.
       */
      const { pageRelation, } = subject;
      return pageRelation.kind === 'undecided';
    },);

    console.log(
      `${runSet}/${artifactFile}  subjects=${String(subjects.length,)} retained=${
        String(retained.length,)
      } replaced=${String(subjects.length - retained.length,)} displaced=${
        String(displaced.length,)
      } undecided=${String(undecided.length,)} verification=${verification.kind}`,
    );
    if (verification.kind === 'refused')
      console.log(`   REFUSED: ${verification.detail}`,);
    if (verification.kind === 'unverifiable') {
      /**
       Recipe halves the file lacks, which the rebuild had to guess.
       */
      const missing = verification.unrecorded
        .join(', ',);
      console.log(`   UNVERIFIABLE (records no ${missing}): ${verification.detail}`,);
    }
  },);
}

//endregion Settled audit buying
