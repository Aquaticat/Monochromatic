import {
  delimiter,
  resolve,
} from 'node:path';
import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  CorpusReadError,
  type CorpusPin,
} from './corpus-source.ts';
import { preparationRootArtifacts, } from './preparation-root-artifacts.ts';
import { preparationRootEntryReadings, } from './preparation-root-entry-readings.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import { matchPreparationRootPopulation, } from './preparation-root-match-population.ts';
import { preparationRootParentReadings, } from './preparation-root-parent-readings.ts';
import { preparationRootPin, } from './preparation-root-pin.ts';
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
 * Selection text and complete caller-loaded supporting bytes are bound to an independently recorded task40 digest.
 * The independent pin supplies corpus location; selection paths are never executed.
 * Process context and pin ownership are fixed before reading other argument properties or calling the logger.
 * Reconstruction parity against an earlier artifact belongs after the I/O owner persists this result.
 *
 * @param input - original selection, independent digest and pin, bounded supporting bytes and caller logger
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
export async function buildPreparationRootInputs(input: {
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
  const fixed = preparationRootPin({
    input,
    origin,
  },);
  /**
   * Evidence or logger accessors cannot retroactively alter the independently owned corpus configuration.
   */
  const {
    text,
    expectedDigest,
    artifacts,
    l,
  } = input;
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
  /**
   * Current native evidence is constructed without reading any supplied parsed artifact or node table.
   */
  const inputs: PreparationRootInputs = {
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
  pl.info(`built unqualified root inputs for ${String(current.parents
    .length,)} frozen parents and ${String(current.registry
      .length,)} initial scope records; no acquisition or writer authority`,);
  return inputs;
}

//endregion Owning semantic preparation input construction
