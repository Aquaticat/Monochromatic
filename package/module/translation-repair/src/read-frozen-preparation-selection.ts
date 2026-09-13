import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { CORPUS_COMMIT_SHA, } from './corpus-source.ts';
import { hashContent, } from './document-node.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { FrozenPreparationSelection, } from './preparation-selection-model.ts';
import {
  FROZEN_PREPARATION_PARENT_COUNT,
  selectionObligations,
  selectionParents,
  selectionReferences,
} from './preparation-selection-records.ts';
import {
  selectionArray,
  selectionDigest,
  selectionRecord,
  selectionString,
} from './preparation-selection-value.ts';

//region Exact task40 frozen-selection identity

/**
 * Supported artifact fields; no newly inserted approval or execution flag is interpreted.
 */
const SELECTION_KEYS = [
  'status',
  'corpus',
  'runtime',
  'runtimeDigest',
  'populationDigest',
  'poolDigest',
  'supersededPopulationDigest',
  'baselineCoordinatesOnly',
  'rules',
  'sampler',
  'census',
  'exclusions',
  'orderedParentIds',
  'dependencies',
  'completeEntryReadings',
  'completeParentReadings',
  'boundaries',
  'references',
] as const;
/**
 * Existing selection pipeline digest encoding, distinct from acquisition runtime.
 */
const PIPELINE_DIGEST_PREFIX = 'sha256-tree-v1:';

/**
 * Parses only after exact expected bytes match, keeping input-bearing syntax errors out of retained causes.
 *
 * @param text - independently matched frozen selection bytes
 *
 * @returns Parsed object for explicit semantic identity checks
 *
 * @throws PreparationRootError when JSON or object shape is unsupported
 *
 * @example
 * ```ts
 * const record = parseSelection(text);
 * ```
 */
function parseSelection(text: string,): Record<string, unknown> {
  try {
    return selectionRecord(JSON.parse(text,),);
  }
  catch (error) {
    if (!(error instanceof SyntaxError))
      throw error;
    throw new PreparationRootError({ kind: 'selection-syntax', },);
  }
}

/**
 * Reads a checked partial projection of exact frozen-selection bytes, not a complete nested-schema or population audit.
 * Referenced files, unprojected metadata and acquisition approval remain later owning boundaries.
 * The expected digest must come from task40's independently recorded authority, never from these same supplied bytes.
 * No sampler, reference path, reading note or model client is executed.
 *
 * @param text - complete serialized frozen-selection artifact
 *
 * @param expectedDigest - independently recorded exact SHA-256, not an artifact self-assertion
 *
 * @param l - caller logger retaining frozen selection scope
 *
 * @returns Owned ordered parent identities, supporting references and unresolved source obligations
 *
 * @throws PreparationRootError when bytes, supported format, parent order or reading inventories disagree
 *
 * @example
 * ```ts
 * const frozen = readFrozenPreparationSelection({ text, expectedDigest, l });
 * ```
 */
export function readFrozenPreparationSelection({
  text,
  expectedDigest,
  l,
}: {
  readonly text: string;
  readonly expectedDigest: string;
  readonly l: Logger;
},): FrozenPreparationSelection {
  /**
   * Artifact identity checks precede all JSON interpretation.
   */
  const pl = tagged({
    tag: readFrozenPreparationSelection.name,
    l,
  },);
  pl.debug('checking independent frozen selection bytes before interpreting parent identities',);
  if (hashContent({ content: text, },) !== expectedDigest)
    throw new PreparationRootError({ kind: 'selection-digest', },);
  /**
   * Native JSON parsing creates owned data; parser details are not retained on failure.
   */
  const record = parseSelection(text,);
  /**
   * Only the supported frozen format is accepted, not a promoted preparation or writer artifact.
   */
  const keys = Object.keys(record,);
  if ((keys.length !== SELECTION_KEYS.length) || SELECTION_KEYS.some(function missing(key,): boolean {
    return !Object.hasOwn(
      record,
      key,
    );
  },)
    || (record.status !== 'parent identities frozen; reading complete; no acquisition or writer approval')
    || (record.baselineCoordinatesOnly !== true))
    throw new PreparationRootError({ kind: 'selection-shape', },);
  /**
   * The selection cannot silently move to another corpus revision.
   */
  const corpus = selectionRecord(record.corpus,);
  if (corpus.commitSha !== CORPUS_COMMIT_SHA)
    throw new PreparationRootError({ kind: 'selection-shape', },);
  /**
   * Historical sampler configuration is bound but never run to redraw parents.
   */
  const sampler = selectionRecord(record.sampler,);
  if ((sampler.name !== 'pickSpreadSample') || (sampler.count !== FROZEN_PREPARATION_PARENT_COUNT)
    || (sampler.seed !== 'none'))
    throw new PreparationRootError({ kind: 'selection-parents', },);
  /**
   * Ordered identity grammar and uniqueness are checked independently of reported counts.
   */
  const parents = selectionParents(record.orderedParentIds,);
  /**
   * Reported reading completion must cover every selected parent and distinct entry.
   */
  const entries = new Set(parents.map(function entry(parent,): string {
    return parent.entryId;
  },),);
  /**
   * Census fields cannot turn a partial reading into the frozen selection.
   */
  const census = selectionRecord(record.census,);
  if ((census.selectedParents !== parents.length) || (record.completeParentReadings !== parents.length)
    || (census.selectedEntries !== entries.size)
    || (record.completeEntryReadings !== entries.size))
    throw new PreparationRootError({ kind: 'selection-parents', },);
  // These policy records remain part of the independently matched bytes, not executable planning instructions.
  for (const rule of selectionArray(record.rules,))
    selectionString(rule,);
  for (const boundary of selectionArray(record.boundaries,))
    selectionString(boundary,);
  for (const exclusion of selectionArray(record.exclusions,))
    selectionRecord(exclusion,);
  /**
   * Historical implementation identity stays separate from the new phase's execution fingerprint.
   */
  const selectionRuntimeDigest = selectionString(record.runtimeDigest,);
  if (!selectionRuntimeDigest.startsWith(PIPELINE_DIGEST_PREFIX,))
    throw new PreparationRootError({ kind: 'selection-shape', },);
  selectionDigest({ value: selectionRuntimeDigest.slice(PIPELINE_DIGEST_PREFIX.length,), },);
  /**
   * References and notes are retained without silently dropping unresolved obligations.
   */
  const references = selectionReferences(record.references,);
  /**
   * Every parent keeps its original ordered reading obligation.
   */
  const obligations = selectionObligations({
    value: record.dependencies,
    parents,
  },);
  pl.info(`read ${String(parents.length,)} frozen parent identities and ${String(references.length,)} unverified supporting references without acquisition approval`,);
  return {
    scope: 'frozen-selection-identity',
    digest: expectedDigest,
    bytes: Buffer.byteLength(
      text,
      'utf8',
    ),
    corpusCommitSha: CORPUS_COMMIT_SHA,
    populationDigest: selectionDigest({ value: record.populationDigest, },),
    poolDigest: selectionDigest({ value: record.poolDigest, },),
    parents,
    references,
    obligations,
    selectionRuntimeDigest,
    samplerNodeVersion: selectionString(sampler.nodeVersion,),
    samplerIcuVersion: selectionString(sampler.icuVersion,),
  };
}

//endregion Exact task40 frozen-selection identity
