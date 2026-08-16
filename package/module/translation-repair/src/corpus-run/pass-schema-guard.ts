import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  ArtifactParseError,
  requireRecord,
} from '../artifact-guard.ts';
import { readArtifactSchemaVersion, } from '../artifact-schema-version.ts';
import { readdirArtifacts, } from './artifact-placement.ts';
import { ARTIFACT_SCHEMA_VERSION_V2, } from './artifact-v2-contract.ts';

//region Pass schema guard
// Refuses to resume an accumulation into a directory whose settled artifacts
// belong to a SCHEMA generation this pass does not write.
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
// this generation answers refuses them. The corpus ends up half one generation
// and half the other, and nothing in the run says so.
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
 * Phrase a refusal uses for artifacts carrying no version field.
 */
const UNVERSIONED_LABEL = 'no schema version at all';

/**
 * Phrase a refusal uses for artifacts whose version this build cannot read.
 *
 * Reachable from a field that is not a count, and from a generation written
 * after this build, which are one answer here: both mean the file names a shape
 * this pass cannot say anything about.
 */
const UNREADABLE_LABEL = 'a schema generation this build cannot read';

/**
 * Entries settled under each generation, keyed by how that generation reads.
 *
 * KEYED BY THE PHRASE rather than by a version number, because three of the
 * answers are not numbers: an artifact can carry no version, carry one this
 * build cannot read, or carry one it reads perfectly well and does not write.
 *
 * @example
 * ```ts
 * const census: SchemaCensus = new Map([['schema version 1', ['Mittens',],],],);
 * ```
 */
export type SchemaCensus = ReadonlyMap<string, readonly string[]>;

/**
 * Reads how one artifact names its generation.
 *
 * @param artifact - artifact as parsed JSON, of any shape
 *
 * @param entryId - entry the artifact belongs to, for the reader's error paths
 *
 * @returns Phrase naming its generation
 *
 * @throws Whatever a reading raised that is not a parse failure, since this
 * classifies artifacts rather than swallowing faults
 *
 * @example
 * ```ts
 * const label = generationLabel({ artifact, entryId: 'Mittens', },);
 * ```
 */
function generationLabel(
  {
    artifact,
    entryId,
  }: {
    readonly artifact: unknown;
    readonly entryId: string;
  },
): string {
  try {
    /**
     * Generation the artifact names, or a named absence.
     */
    const reading = readArtifactSchemaVersion({
      artifact: requireRecord({
        value: artifact,
        path: entryId,
      },),
      path: entryId,
    },);

    return (reading.kind === 'versioned')
      ? `schema version ${String(reading.version,)}`
      : UNVERSIONED_LABEL;
  } catch (error) {
    // A file that is not a record at all lands here too, and is left with the
    // unreadable-generation answer on purpose: the pipeline guard runs first
    // and refuses such a file as unplaceable, with the remedy that case wants,
    // so reaching here means somebody called this guard alone.
    if (error instanceof ArtifactParseError)
      return UNREADABLE_LABEL;

    throw error;
  }
}

/**
 * Groups every settled entry by the generation its artifact names.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns Entry ids per generation, each list in directory-sorted order
 *
 * @example
 * ```ts
 * const census = await censusBySchema({ artifactsDir, },);
 * ```
 */
export async function censusBySchema(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<SchemaCensus> {
  /**
   * Artifact names, sorted so a refusal reads the same twice.
   */
  const names = (await readdirArtifacts({ artifactsDir, },))
    .filter(function isArtifact(name,): boolean {
      return name.endsWith(ARTIFACT_SUFFIX,);
    },)
    .toSorted();

  /**
   * Each entry paired with the generation it belongs to.
   */
  const labelled = await Promise.all(names.map(async function readOne(name,): Promise<readonly [
    string,
    string,
  ]> {
    /**
     * Entry id, which is the file name without its suffix.
     */
    const entryId = name.slice(
      0,
      -ARTIFACT_SUFFIX.length,
    );

    /**
     * Artifact text as it sits on disk.
     */
    const text = await readFile(
      join(
        artifactsDir,
        name,
      ),
      'utf8',
    );

    try {
      return [
        generationLabel({
          artifact: JSON.parse(text,),
          entryId,
        },),
        entryId,
      ];
    } catch (error) {
      // A file that is not JSON is refused rather than skipped. The pipeline
      // guard already refuses it as unplaceable, so this is unreachable in a
      // pass, and skipping it would answer a question about a directory by
      // ignoring part of the directory.
      if (error instanceof SyntaxError)
        return [
          UNREADABLE_LABEL,
          entryId,
        ];

      throw error;
    }
  },),);

  return labelled.reduce(
    function group(
      census: Map<string, readonly string[]>,
      [
        label,
        entryId,
      ],
    ): Map<string, readonly string[]> {
      return census.set(
        label,
        [
          ...(census.get(label,) ?? []),
          entryId,
        ],
      );
    },
    new Map<string, readonly string[]>(),
  );
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
 * Raised when a resume would settle a second artifact generation into one pool.
 */
export class SchemaGenerationError extends Error {
  /**
   * Names every foreign generation, what this pass writes, and both ways
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
      readonly foreign: SchemaCensus;
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
        'answers refuses them. Resuming here produces a corpus that is half one',
        'generation and half the other, and nothing in the run reports it.',
        '',
        'The pipeline drift opt-in does not cover this and is not asked about.',
        'Drift is an opinion about which BUILD wrote a pool, and its remedy,',
        'naming a required commit alongside the rate, works because every file',
        'still answers the same questions. A file of another schema generation',
        'cannot answer them at all.',
        '',
        'Two ways forward:',
        '',
        '  Start a fresh directory, with TRANSLATION_REPAIR_RUNS_DIR. The',
        '  entries already here keep their own generation and stay readable.',
        '',
        '  Restore the code those entries were settled under and resume there,',
        '  which matches the schema and the build at once.',
        '',
        'Deleting them is NOT the remedy. They are sound results of the',
        'generation that wrote them.',
      ].join('\n',),
    );
    this.name = 'SchemaGenerationError';
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
   * Every settled entry, grouped by the generation it belongs to.
   */
  const census = await censusBySchema({ artifactsDir, },);

  /**
   * Phrase the generation this pass writes reads as, which is the one group
   * that may be there.
   */
  const mine = `schema version ${String(writes,)}`;

  /**
   * Groups belonging to any other generation.
   */
  const foreign = new Map([...census.entries(),].filter(function isForeign([label,],): boolean {
    return label !== mine;
  },),);

  if (foreign.size === 0)
    return;

  throw new SchemaGenerationError({
    foreign,
    writes,
  },);
}

//endregion Pass schema guard
