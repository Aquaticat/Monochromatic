import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { ARTIFACT_SCHEMA_VERSION_V2, } from './artifact-v2-contract.ts';
import { parseSettledArtifactV2, } from './artifact-v2-read.ts';
import {
  censusBySchema,
  type SchemaCensusRow,
  type SchemaClassification,
} from './pass-schema-census.ts';

//region Pass schema guard
// Refuses to resume an accumulation into a directory whose settled artifacts do
// not belong to the SCHEMA generation this pass writes.
//
// A sibling of the pipeline guard rather than more of it, because it answers a
// different question with a different remedy. That one asks which BUILD wrote
// the pool, and its opt-in exists because a mixed-build pool is still readable
// once a rate names a required commit. This one asks which SHAPE the files
// have, and no commit makes a version 1 artifact answer a two-lane question.
//
// The two overlap in practice and neither covers the other. A build that writes
// version 1 cannot share a digest with one that writes version 2, so the
// ordinary mixed-schema resume is already refused as pipeline drift. What
// reaches here is the case that opt-in lets through: an operator who accepted a
// mixed-BUILD pool, on a promise about required commits that schema drift does
// not keep.
//
// WHY IT MATTERS AT ALL, given the pass would still run: the scheduler counts
// every `.json` NAME as settled (`pass-settled.ts`), so entries of the other
// generation are never re-run, while every reader that asks them a question
// this generation answers refuses them. The corpus ends up part one generation
// and part the other, and nothing in the run says so.
//
// THE LABEL IS NOT THE SHAPE, which an independent review of the first version
// of this guard pointed out and which it did not check. A version 1 body whose
// `artifactSchemaVersion` is edited to 2 satisfied every check here, was
// skipped by the scheduler, and failed only later in whatever reader asked it a
// two-lane question. So every artifact declaring the generation this pass
// writes is now PARSED with that generation's reader, at the one boundary where
// refusing is still free. The cost is one full parse per settled artifact at
// startup, against a pass that runs for days.
//
// NOT OVERRIDABLE, deliberately, and not by a variable of its own either. A
// second opt-in would recreate the hole this closes; the remedies belong in the
// message, and choosing between them costs re-running entries, which is money
// and therefore the operator's call rather than this guard's.

/**
 * How many entries a refusal names per generation before it reports a count for
 * the rest.
 */
const NAMED_EXAMPLES = 5;

/**
 * Suffix every artifact file carries.
 */
const ARTIFACT_SUFFIX = '.json';

/**
 * Phrase naming one classification, for a refusal.
 *
 * BUILT FROM THE CLASSIFICATION rather than used as its key, so a message can
 * distinguish a sound artifact of another generation from a file that is not an
 * artifact, and can offer each the remedy that fits.
 *
 * @param classification - what the census made of one file
 *
 * @returns Phrase a refusal groups by
 *
 * @example
 * ```ts
 * const label = generationLabel({ classification, },);
 * ```
 */
function generationLabel(
  { classification, }: { readonly classification: SchemaClassification; },
): string {
  if (classification.kind === 'declared')
    return `schema version ${String(classification.version,)}`;

  if (classification.kind === 'unversioned')
    return 'no schema version at all';

  if (classification.kind === 'unreadable-version')
    return 'a schema generation this build cannot read';

  return 'not an artifact this build recognizes at all';
}

/**
 * Names one generation and the entries settled under it.
 *
 * @param label - phrase naming the generation
 *
 * @param entryIds - entries settled under it
 *
 * @returns One line for the refusal
 *
 * @example
 * ```ts
 * const line = generationLine({ label: 'schema version 1', entryIds, },);
 * ```
 */
function generationLine(
  {
    label,
    entryIds,
  }: {
    readonly label: string;
    readonly entryIds: readonly string[];
  },
): string {
  /**
   * Entries named outright, capped so a corpus-sized directory still produces a
   * readable refusal.
   */
  const named = entryIds.slice(
    0,
    NAMED_EXAMPLES,
  );

  /**
   * Entries beyond the ones named.
   */
  const rest = entryIds.length - named.length;

  return `  ${label}: ${String(entryIds.length,)} settled, ${named.join(', ',)}${
    rest > 0 ? `, and ${String(rest,)} more` : ''
  }`;
}

/**
 * Ways forward every refusal here ends with, in the order an operator should
 * consider them.
 *
 * ARCHIVING IS ONE OF THEM, which the first version of this message denied. It
 * said deleting was not the remedy, full stop, and that is false: moving an
 * incompatible artifact out of the directory is exactly what lets the scheduler
 * re-run that entry, and moving it rather than deleting keeps the sound result
 * it already is.
 */
const WAYS_FORWARD = [
  'Ways forward:',
  '',
  '  Start a fresh directory, with TRANSLATION_REPAIR_RUNS_DIR. The entries',
  '  already here keep their own generation and stay readable.',
  '',
  '  Restore the code those entries were settled under and resume there,',
  '  which matches the schema and the build at once.',
  '',
  '  Move the incompatible artifacts to an archive directory and resume here.',
  '  The scheduler counts filenames, so each one moved out is re-run and paid',
  '  for again, and the archived copy stays readable as the generation it is.',
  '',
  'Deleting them outright is the one thing to avoid: it costs the same re-run',
  'and destroys a sound result of the generation that wrote it.',
];

/**
 * Raised when a resume would settle a second artifact generation into one pool.
 */
export class SchemaGenerationError extends Error {
  /**
   * Names every foreign generation, what this pass writes, and every way
   * forward.
   *
   * @param foreign - entries per generation this pass does not write
   *
   * @param writes - generation this pass writes
   *
   * @example
   * ```ts
   * throw new SchemaGenerationError({ foreign, writes: 2, },);
   * ```
   */
  constructor(
    {
      foreign,
      writes,
    }: {
      readonly foreign: ReadonlyMap<string, readonly string[]>;
      readonly writes: number;
    },
  ) {
    super(
      [
        'This artifacts directory holds artifacts of another schema generation.',
        '',
        ...[...foreign.entries(),].map(function toLine([
          label,
          entryIds,
        ],): string {
          return generationLine({
            label,
            entryIds,
          },);
        },),
        `  this pass writes schema version ${String(writes,)}`,
        '',
        'The scheduler counts every .json NAME as settled, so those entries are',
        'never re-run, while every reader asking them a question this generation',
        'answers refuses them. Resuming here produces a corpus that is part one',
        'generation and part another, and nothing in the run reports it.',
        '',
        'The pipeline drift opt-in does not cover this and is not asked about.',
        'Drift is an opinion about which BUILD wrote a pool, and its remedy,',
        'naming a required commit alongside the rate, works because every file',
        'still answers the same questions. A file of another schema generation',
        'cannot answer them at all.',
        '',
        ...WAYS_FORWARD,
      ].join('\n',),
    );
    this.name = 'SchemaGenerationError';
  }
}

/**
 * Raised when an artifact declares the generation this pass writes and is not
 * one.
 */
export class MislabelledArtifactError extends Error {
  /**
   * Names the entry and what its own generation's reader refused.
   *
   * @param entryId - entry whose artifact carries the wrong label
   *
   * @param writes - generation it claims
   *
   * @param reason - what the reader for that generation said
   *
   * @example
   * ```ts
   * throw new MislabelledArtifactError({ entryId: 'Mittens', writes: 2, reason, },);
   * ```
   */
  constructor(
    {
      entryId,
      writes,
      reason,
    }: {
      readonly entryId: string;
      readonly writes: number;
      readonly reason: string;
    },
  ) {
    super(
      [
        `${entryId} declares schema version ${
          String(writes,)
        }, which is what this pass writes, and is not one:`,
        '',
        `  ${reason}`,
        '',
        'A label is not a shape. The scheduler counts this file as settled and',
        'never re-runs the entry, so a body that does not satisfy the generation',
        'it claims is discovered by whichever reader asks it a question first,',
        'long after the pass that could have refused it.',
        '',
        'This is not ordinary drift: no other generation writes this label, so',
        'the file was edited, truncated, or written by something that is not',
        'this pipeline.',
        '',
        ...WAYS_FORWARD,
      ].join('\n',),
    );
    this.name = 'MislabelledArtifactError';
  }
}

/**
 * Groups foreign census rows by the phrase a refusal names them with.
 *
 * @param rows - every settled entry's classification
 *
 * @param writes - generation this pass writes
 *
 * @returns Entries per foreign generation, in census order
 *
 * @example
 * ```ts
 * const foreign = foreignGroups({ rows, writes: 2, },);
 * ```
 */
function foreignGroups(
  {
    rows,
    writes,
  }: {
    readonly rows: readonly SchemaCensusRow[];
    readonly writes: number;
  },
): ReadonlyMap<string, readonly string[]> {
  return rows
    .filter(function isForeign({ classification, },): boolean {
      return (classification.kind !== 'declared') || (classification.version !== writes);
    },)
    .reduce(
      function group(
        groups: Map<string, readonly string[]>,
        {
          entryId,
          classification,
        },
      ): Map<string, readonly string[]> {
        /**
         * Phrase this row is named under.
         */
        const label = generationLabel({ classification, },);

        return groups.set(
          label,
          [
            ...(groups.get(label,) ?? []),
            entryId,
          ],
        );
      },
      new Map<string, readonly string[]>(),
    );
}

/**
 * Refuses an artifact that declares this generation and does not satisfy it.
 *
 * @param artifactsDir - directory holding the artifact
 *
 * @param entryId - entry to check
 *
 * @param writes - generation it declares
 *
 * @throws {@link MislabelledArtifactError} when this generation's reader
 * refuses the body
 *
 * @example
 * ```ts
 * await assertBodyMatchesLabel({ artifactsDir, entryId: 'Mittens', writes: 2, },);
 * ```
 */
async function assertBodyMatchesLabel(
  {
    artifactsDir,
    entryId,
    writes,
  }: {
    readonly artifactsDir: string;
    readonly entryId: string;
    readonly writes: number;
  },
): Promise<void> {
  /**
   * Artifact text as it sits on disk, read again rather than carried out of the
   * census: the census answers a question about every file and holding every
   * body in memory to answer it would cost the whole directory at once.
   */
  const text = await readFile(
    join(
      artifactsDir,
      `${entryId}${ARTIFACT_SUFFIX}`,
    ),
    'utf8',
  );

  try {
    parseSettledArtifactV2({ value: JSON.parse(text,), },);
  } catch (error) {
    throw new MislabelledArtifactError({
      entryId,
      writes,
      reason: caughtValueText(error,),
    },);
  }
}

/**
 * Refuses a resume that would mix artifact generations in one directory.
 *
 * Silent on a fresh directory and on a resume into one this pass wrote, which
 * are the two ordinary cases. It reads the artifacts rather than a marker, so a
 * directory assembled by hand is judged on what it holds.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @param writes - generation this pass writes, defaulting to the one it writes
 * today; a parameter so a caller can exercise this without rebuilding
 *
 * @throws {@link SchemaGenerationError} when any settled artifact belongs to
 * another generation, naming every one of them
 *
 * @throws {@link MislabelledArtifactError} when an artifact declares this
 * generation and this generation's reader refuses it
 *
 * @example
 * ```ts
 * await assertResumableSchemaGeneration({ artifactsDir, },);
 * ```
 */
export async function assertResumableSchemaGeneration(
  {
    artifactsDir,
    writes = ARTIFACT_SCHEMA_VERSION_V2,
  }: {
    readonly artifactsDir: string;
    readonly writes?: number;
  },
): Promise<void> {
  /**
   * Every settled entry, classified.
   */
  const rows = await censusBySchema({ artifactsDir, },);

  /**
   * Entries belonging to any other generation.
   */
  const foreign = foreignGroups({
    rows,
    writes,
  },);

  if (foreign.size > 0) {
    throw new SchemaGenerationError({
      foreign,
      writes,
    },);
  }

  // THE LABEL CHECK PASSED, so every remaining file claims this generation.
  // Now they have to BE it, which only this generation's reader can say.
  await Promise.all(
    rows.map(async function checkBody({ entryId, },): Promise<void> {
      await assertBodyMatchesLabel({
        artifactsDir,
        entryId,
        writes,
      },);
    },),
  );
}

//endregion Pass schema guard
