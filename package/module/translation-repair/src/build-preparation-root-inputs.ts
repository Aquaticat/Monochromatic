import {
  delimiter,
  isAbsolute,
  resolve,
} from 'node:path';
import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  CORPUS_COMMIT_SHA,
  CorpusReadError,
  type CorpusPin,
} from './corpus-source.ts';
import { preparationRootArtifacts, } from './preparation-root-artifacts.ts';
import { preparationRootEntryReadings, } from './preparation-root-entry-readings.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import { matchPreparationRootPopulation, } from './preparation-root-match-population.ts';
import { preparationRootParentReadings, } from './preparation-root-parent-readings.ts';
import {
  readPreparationRootPopulation,
  type PreparationRootPopulation,
} from './preparation-root-population.ts';
import type { PreparationRootInputs, } from './preparation-root-reference-model.ts';
import { preparationRootQuestionAliases, } from './preparation-root-registration.ts';
import {
  assertPreparationRootEqual,
  preparationRootRecord,
} from './preparation-root-value.ts';
import type { PreparationArtifactInput, } from './preparation-selection-evidence-model.ts';
import type { FrozenPreparationSelection, } from './preparation-selection-model.ts';
import { readPreparationSelectionEvidence, } from './read-preparation-selection-evidence.ts';

//region Owning semantic preparation input construction

/**
 * Snapshots independent corpus authority and pins path resolution before asynchronous work or logger callbacks.
 *
 * @param pin - caller-owned location, pinned commit and optional absolute native executable
 *
 * @returns Owned corpus configuration with stable absolute paths
 *
 * @throws PreparationRootError when the pin is unsupported or cannot be snapshotted
 *
 * @example
 * ```ts
 * const fixed = preparationRootPin(pin);
 * ```
 */
function preparationRootPin(pin: CorpusPin,): CorpusPin {
  /**
   * Even a descriptor-backed configuration cannot change the origin used for a relative clone path.
   */
  const origin = process.cwd();
  try {
    /**
     * Corpus paths are configuration data, not instructions read from the frozen selection document.
     */
    const fixed = structuredClone(pin,);
    if ((fixed.commitSha !== CORPUS_COMMIT_SHA) || ((typeof fixed.cloneDir) !== 'string')
      || (fixed.cloneDir
        .trim()
        .length
        === 0)
      || ((fixed.gitPath !== undefined) && (((typeof fixed.gitPath) !== 'string') || (!isAbsolute(fixed.gitPath,)))))
      throw new PreparationRootError({ kind: 'corpus-identity', },);
    return {
      cloneDir: resolve(
        origin,
        fixed.cloneDir,
      ),
      commitSha: fixed.commitSha,
      ...fixed.gitPath === undefined ? {} : { gitPath: fixed.gitPath, },
    };
  }
  catch (error) {
    if (error instanceof PreparationRootError)
      throw error;
    // Native clone/getter details are not required to explain a rejected independent pin.
    throw new PreparationRootError({ kind: 'corpus-identity', },);
  }
}

/**
 * Converts native listing failures to the root's names-only diagnostic without classifying them as exclusions.
 *
 * @param pin - owned batch-resolved corpus configuration
 *
 * @param selection - independently checked frozen identity
 *
 * @param l - caller logger retaining root provenance
 *
 * @returns Current native population, with no sampler or provider invocation
 *
 * @throws PreparationRootError when native corpus listing fails
 *
 * @example
 * ```ts
 * const current = await currentRootPopulation({ pin, selection, l });
 * ```
 */
async function currentRootPopulation({
  pin,
  selection,
  l,
}: {
  readonly pin: CorpusPin;
  readonly selection: FrozenPreparationSelection;
  readonly l: Logger;
},): Promise<PreparationRootPopulation> {
  /**
   * Only the expected native read error is reclassified at this boundary.
   */
  const pl = tagged({
    tag: currentRootPopulation.name,
    l,
  },);
  try {
    return await readPreparationRootPopulation({
      pin,
      selection,
      l: pl,
    },);
  }
  catch (error) {
    if (!(error instanceof CorpusReadError))
      throw error;
    pl.warn(`native population listing failed with ${error.kind}; subprocess details were not retained`,);
    throw new PreparationRootError({
      kind: 'corpus-read',
      input: 'people/',
    },);
  }
}

/**
 * Owns complete frozen-artifact relationships and current pinned corpus reconstruction before acquisition planning.
 * Supporting bytes must already be size-bounded by their authorized I/O owner; no reference locator is opened here.
 * The result is unqualified input evidence, not a reviewed phase, writer plan or permission to create providers.
 * Historical support without a consumed relationship remains byte-bound opaque data and is never executed.
 *
 * @param text - complete original selection bytes as UTF-8 text
 *
 * @param expectedDigest - independently recorded task40 identity, never a digest derived from supplied bytes
 *
 * @param artifacts - complete caller-loaded raw supporting inventory
 *
 * @param pin - independently authorized corpus location; recorded selection paths are not executed
 *
 * @param l - caller logger retaining root construction scope
 *
 * @returns Current raw/effective identities, complete reading provenance and finite initial parent scope
 *
 * @throws PreparationRootError when frozen evidence, current policy population or source obligations differ
 *
 * @example
 * ```ts
 * const inputs = await buildPreparationRootInputs({ text, expectedDigest, artifacts, pin, l });
 * ```
 */
export async function buildPreparationRootInputs({
  text,
  expectedDigest,
  artifacts,
  pin,
  l,
}: {
  readonly text: string;
  readonly expectedDigest: string;
  readonly artifacts: readonly PreparationArtifactInput[];
  readonly pin: CorpusPin;
  readonly l: Logger;
},): Promise<PreparationRootInputs> {
  /**
   * Pin location cannot drift when subsequent callbacks or awaits change process context.
   */
  const origin = process.cwd();
  /**
   * Native executable lookup context cannot be changed by later logger or descriptor callbacks.
   */
  const lookup = {
    pathEnv: (process.env
      .PATH
      ?? '').split(delimiter,)
      .map(function absoluteDirectory(path,): string { return resolve(
        origin,
        path,
      ); },)
      .join(delimiter,),
    platform: process.platform,
    pathExtensions: process.env
      .PATHEXT
      ?? '.COM;.EXE;.BAT;.CMD',
  };
  /**
   * Independent pin fields are copied only after lookup context is fixed.
   */
  const fixed = preparationRootPin(pin,);
  /**
   * The public owner never accepts a pre-decoded selection or previously mutable byte-match certificate.
   */
  const pl = tagged({
    tag: buildPreparationRootInputs.name,
    l,
  },);
  /**
   * Fresh raw matching establishes private byte ownership before any asynchronous corpus work.
   */
  const evidence = readPreparationSelectionEvidence({
    text,
    expectedDigest,
    artifacts,
    l: pl,
  },);
  /**
   * Parsing already verified selection text supplies fields deliberately absent from its partial projection.
   */
  const record = preparationRootRecord(JSON.parse(text,),);
  /**
   * Role interpretation is internal and cannot infer call authority from unconsumed support.
   */
  const reader = preparationRootArtifacts({
    evidence,
    l: pl,
  },);
  /**
   * Batch ownership resolves native Git once rather than rereading its executable for every corpus file.
   */
  const resolvedPin: CorpusPin = {
    ...fixed,
    gitPath: fixed.gitPath ?? await resolveGit(lookup,),
  };
  /**
   * Full current population reconstruction cannot redraw or replace a failed frozen parent.
   */
  const current = await currentRootPopulation({
    pin: resolvedPin,
    selection: evidence.selection,
    l: pl,
  },);
  matchPreparationRootPopulation({
    selection: evidence.selection,
    record,
    artifacts: reader,
    current,
  },);
  /**
   * Complete entry context is established before interpreting any parent-level carry-forward claim.
   */
  const entryReadings = preparationRootEntryReadings({
    artifacts: reader,
    current,
  },);
  /**
   * Rebuilt notes must retain the same unresolved source obligations as the frozen artifact.
   */
  const obligations = preparationRootParentReadings({
    parents: current.parents,
    entryReadings,
    artifacts: reader,
  },);
  assertPreparationRootEqual({
    actual: obligations,
    expected: evidence.selection
      .obligations,
    kind: 'reading-provenance',
  },);
  pl.info(`built unqualified root inputs for ${String(current.parents
    .length,)} frozen parents and ${String(current.registry
      .length,)} initial scope records; no acquisition or writer authority`,);
  return {
    scope: 'unqualified-preparation-root-inputs',
    selection: evidence.selection,
    references: reader.references(),
    rawDocuments: current.rawDocuments,
    listedEntryIds: current.listedEntryIds,
    population: current.population,
    excluded: current.excluded,
    entries: current.entries,
    parents: current.parents,
    obligations,
    registry: current.registry,
    unalignedDefinitions: current.unalignedDefinitions,
    questionAliases: preparationRootQuestionAliases(current.registry,),
    sectionPairing: 'not-registered',
  };
}

//endregion Owning semantic preparation input construction
