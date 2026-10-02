import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

//region Living repository-level docs
// The repository-level translation-repair docs that state current fact and are
// kept current (ledger D26 and D30): the decision records, the canonical
// handover and the snapshot it links, the planning docs that handover links as
// current, and the runbooks and troubleshooting docs.
// The archived documents (history segments, dated snapshots, run-continuity
// parts, interface-candidate files) are kept byte for byte and are not read;
// `doc/handover/translation-repair-document-map.md` says how to read their task
// numbers. `task-list-numbers.unit.test.ts` and `clock-time-zones.unit.test.ts`
// read through it.

/**
 Repository root, four levels above `src`.
 */
export const REPOSITORY_ROOT: string = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
);

/**
 Canonical handover, from the repository root; it links the current snapshot.
 */
const HANDOVER_INDEX = join(
  'doc',
  'handover',
  'translation-repair.md',
);

/**
 Planning docs the canonical handover or its snapshot links as current: where
 the readiness judgement lives, and the OpenRouter pass log that records every
 run since the takeover. Checked against the links on every read, so a doc
 dropped from them fails here rather than being read as current.
 */
const CURRENT_PLANNING: readonly string[] = [
  'translation-repair-readiness-signal.md',
  'translation-repair-openrouter-2026-09-03.md',
];

/**
 The living repository-level docs, as paths from the repository root.
 */
type LivingRepositoryDocs = {
  /**
   Every `doc/decision/translation-repair*.md`.
   */
  readonly decisionRecords: readonly string[];

  /**
   The canonical handover and the snapshot it links.
   */
  readonly handover: readonly string[];

  /**
   The planning docs the handover links as current.
   */
  readonly currentPlanning: readonly string[];

  /**
   Every translation-repair runbook and troubleshooting doc, the operational
   references a pass is run and debugged by (ledger D30).
   */
  readonly operations: readonly string[];
};

/**
 Every Markdown link target in a text: what follows each `](` up to its `)`,
 without a fragment.

 @param text - Markdown text

 @returns Targets in text order

 @example
 ```ts
 linkTargets({ text: 'see [the nap log](naps.md#noon)', },); // ['naps.md']
 ```
 */
function linkTargets({ text, }: { readonly text: string; },): readonly string[] {
  return text
    .split('](',)
    .slice(1,)
    .flatMap(function target(after,): readonly string[] {
      /**
       Where the target closes.
       */
      const end = after.indexOf(')',);
      if (end === (-1))
        return [];
      /**
       Target with any fragment.
       */
      const whole = after.slice(
        0,
        end,
      );
      /**
       Where a fragment opens, or the end.
       */
      const fragment = whole.indexOf('#',);
      return [fragment === (-1) ? whole : whole.slice(
        0,
        fragment,
      ),];
    },);
}

/**
 Every translation-repair Markdown doc in one `doc` family, sorted so failures
 read in a stable order.

 @param family - directory under `doc`, such as `decision`

 @returns Paths from the repository root

 @example
 ```ts
 const records = await translationRepairDocs({ family: 'decision', },);
 ```
 */
async function translationRepairDocs({ family, }: { readonly family: string; },): Promise<readonly string[]> {
  return (await readdir(join(
    REPOSITORY_ROOT,
    'doc',
    family,
  ),))
    .filter(function isTranslationRepair(name,): boolean {
      return name.startsWith('translation-repair',) && name.endsWith('.md',);
    },)
    .toSorted()
    .map(function underFamily(name,): string {
      return join(
        'doc',
        family,
        name,
      );
    },);
}

/**
 The living repository-level docs, located from the canonical handover.

 @returns Paths from the repository root, by kind

 @throws {@link Error} when the canonical handover links no snapshot, or when a
 planning doc listed as current is linked from neither the handover nor its
 snapshot, since the guards would then read other than they claim

 @example
 ```ts
 const { decisionRecords, handover, currentPlanning, operations, } = await readLivingRepositoryDocs();
 ```
 */
export async function readLivingRepositoryDocs(): Promise<LivingRepositoryDocs> {
  /**
   Links in the canonical handover.
   */
  const indexLinks = linkTargets({ text: await readFile(
    join(
      REPOSITORY_ROOT,
      HANDOVER_INDEX,
    ),
    'utf8',
  ), },);
  /**
   The snapshot's file name, from the first link to one.
   */
  const snapshot = indexLinks.find(function isSnapshot(target,): boolean {
    return target.startsWith('translation-repair-handover-',) && target.endsWith('.md',);
  },);
  if (snapshot === undefined)
    throw new Error(`${HANDOVER_INDEX} links no handover snapshot`,);
  /**
   The snapshot, from the repository root.
   */
  const snapshotPath = join(
    'doc',
    'handover',
    snapshot,
  );
  /**
   Every target the handover and its snapshot link.
   */
  const linked = new Set([
    ...indexLinks,
    ...linkTargets({ text: await readFile(
      join(
        REPOSITORY_ROOT,
        snapshotPath,
      ),
      'utf8',
    ), },),
  ],);
  /**
   Planning docs listed as current that neither links.
   */
  const unlinked = CURRENT_PLANNING.filter(function isUnlinked(name,): boolean {
    return !linked.has(join(
      '..',
      'planning',
      name,
    ),);
  },);
  if (unlinked.length > 0)
    throw new Error(`neither ${HANDOVER_INDEX} nor ${snapshotPath} links ${unlinked.join(', ',)} any more`,);
  return {
    decisionRecords: await translationRepairDocs({ family: 'decision', },),
    handover: [
      HANDOVER_INDEX,
      snapshotPath,
    ],
    operations: [
      ...await translationRepairDocs({ family: 'runbook', },),
      ...await translationRepairDocs({ family: 'troubleshooting', },),
    ],
    currentPlanning: CURRENT_PLANNING.map(function underPlanning(name,): string {
      return join(
        'doc',
        'planning',
        name,
      );
    },),
  };
}

//endregion Living repository-level docs
