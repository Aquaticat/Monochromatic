import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
} from '@monochromatic-dev/translation-repair-artifact-pool/ts';
import { wordForCount, } from '@monochromatic-dev/translation-repair-typography/ts';
import type { ArtifactKeyVocabulary, } from '../artifact-key-vocabulary.ts';
import type {
  ArtifactConsolidateSlice,
  ArtifactConsolidationTerminal,
} from './artifact-two-lane-consolidate.ts';
import {
  parseGateBallot,
  parseShipped,
  parseVerdict,
} from './artifact-two-lane-read-consolidate-parts.ts';
import { parseRecordedTenseCandidates, } from './artifact-two-lane-read-tense.ts';
import { shippedTenseLabelOf, } from '@monochromatic-dev/translation-repair-translate-stage/ts';
import type { TenseCandidateGroup, } from '@monochromatic-dev/translation-repair-translate-stage/ts';
import { parseConsolidationPolish, } from './artifact-two-lane-read-polish.ts';

//region Artifact consolidated slice read

/**
 Ways settlement can leave stage, including retired artifact spelling.

 KEYED BY `ArtifactConsolidationTerminal` rather than listed, so the compiler
 refuses a terminal the stage gains that this reader lacks, which would
 otherwise leave every artifact carrying it refused whole. The order is the
 order a refusal names them in.
 */
const TERMINAL_NAMES: Readonly<Record<ArtifactConsolidationTerminal, true>> = {
  'incumbent-only': true,
  'no-standing-text': true,
  'slate-endorsed-standing': true,
  'slate-unjudged-standing': true,
  'slate-declined-standing': true,
  'slate-kept-standing': true,
  'gate-kept-standing': true,
  'wrap-erased-difference': true,
  consolidated: true,
};

/**
 Whether a stored value names a way settlement can leave stage.

 @param value - terminal as the artifact carries it

 @returns Whether it is one of the names `TERMINAL_NAMES` holds

 @example
 ```ts
 const known = isTerminalName('consolidated',);
 ```
 */
function isTerminalName(value: unknown,): value is ArtifactConsolidationTerminal {
  return ((typeof value) === 'string')
    && Object.hasOwn(
      TERMINAL_NAMES,
      value,
    );
}

/**
 Reads what fidelity gate settled or that it was never asked.

 @param value - gate field

 @param path - artifact path

 @returns Parsed gate record

 @example
 ```ts
 const gate = parseGate({ value, path, });
 ```
 */
function parseGate(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactConsolidateSlice['gate'] {
  /**
   Gate field as record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  if (record.kind === 'not-asked') {
    requireExactKeys({
      record,
      allowed: ['kind',],
      path,
    },);
    return { kind: 'not-asked', };
  }
  if (record.kind !== 'asked') {
    throw new ArtifactParseError({
      path: `${path}.kind`,
      reason: 'one of asked, not-asked',
    },);
  }
  requireExactKeys({
    record,
    allowed: [
      'kind',
      'ballots',
      'usable',
    ],
    path,
  },);
  /**
   Every gate ballot.
   */
  const ballotRows = requireArray({
    value: record.ballots,
    path: `${path}.ballots`,
  },);
  /**
   Parsed gate ballots.
   */
  const ballots = ballotRows.map(function readOne(
    entry,
    at,
  ) {
    return parseGateBallot({
      value: entry,
      path: `${path}.ballots[${String(at,)}]`,
    },);
  },);
  /**
   Recorded usable voice count.
   */
  const usable = requireCount({
    value: record.usable,
    path: `${path}.usable`,
  },);
  if (usable !== ballots.length) {
    throw new ArtifactParseError({
      path: `${path}.usable`,
      reason: `${String(ballots.length,)} matching stored ${
        wordForCount({
          count: ballots.length,
          one: 'ballot',
          many: 'ballots',
        },)
      }`,
    },);
  }
  return {
    kind: 'asked',
    ballots,
    usable,
  };
}

/**
 Reads the tense finding a consolidation slice records for the wording it ships.

 A SLICE THAT SHIPS NO WORDING OF ITS OWN (the archive kept, or nothing
 changed) has no shipped text to read a finding from; the contest record holds
 the candidates of what it leaves, so a finding here is refused rather than
 dropped unread.

 @param value - recorded `tenseCandidates` value, absent when the record carries none

 @param shipped - wording the slice ships, already read

 @param path - artifact path of the value, for refusals

 @returns The finding as a record fragment, empty when the slice carries none

 @throws {@link ArtifactParseError} when a slice that ships no wording of its own carries a finding, or when the finding
 is not a non-empty list of groups under the one label the sheets gave the shipped wording

 @example
 ```ts
 const tense = parseShippedTense({ value: undefined, shipped: { kind: 'unchanged', }, path: 'x.tenseCandidates', },);
 ```
 */
function parseShippedTense(
  {
    value,
    shipped,
    path,
  }: {
    readonly value: unknown;
    readonly shipped: ArtifactConsolidateSlice['shipped'];
    readonly path: string;
  },
): { readonly tenseCandidates?: readonly TenseCandidateGroup[]; } {
  if (value === undefined)
    return {};
  if ((shipped.kind === 'archive') || (shipped.kind === 'unchanged')) {
    throw new ArtifactParseError({
      path,
      reason: 'no tense candidates, since a slice that ships no wording of its own has no shipped text to read them from',
    },);
  }
  return {
    tenseCandidates: parseRecordedTenseCandidates({
      value,
      path,
      labels: [shippedTenseLabelOf({ kind: shipped.kind, }),],
    },),
  };
}

/**
 Reads one consolidated slice under generation-selected shape.

 @param value - slice record

 @param path - artifact path

 @param keys - generation key spellings

 @param polishRequired - whether generation records final body polish

 @param reviewRequired - whether polish record carries absolute naturalness review

 @param correctionChainRequired - whether review carries digest-bound corrections

 @param everyBodyBlockReviewed - whether reviewed paragraphs are every body
 block rather than the refinable paragraphs alone

 @param quorumBasisRequired - whether review rounds retain their wider quorum

 @param tenseRecorded - whether the generation records the tense candidates of the shipped wording

 @returns Parsed consolidation slice

 @example
 ```ts
 const slice = parseConsolidateSlice({ value, path, keys, polishRequired: true, });
 ```
 */
export function parseConsolidateSlice(
  {
    value,
    path,
    keys,
    polishRequired,
    reviewRequired = false,
    correctionChainRequired = false,
    everyBodyBlockReviewed = false,
    quorumBasisRequired = false,
    tenseRecorded = false,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly keys: ArtifactKeyVocabulary;
    readonly polishRequired: boolean;
    readonly reviewRequired?: boolean;
    readonly correctionChainRequired?: boolean;
    readonly everyBodyBlockReviewed?: boolean;
    readonly quorumBasisRequired?: boolean;
    readonly tenseRecorded?: boolean;
  },
): ArtifactConsolidateSlice {
  /**
   Slice as exact record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      keys.sliceIndex,
      'terminal',
      'shipped',
      'rewrapped',
      'demoted',
      'verdicts',
      'gate',
      ...(polishRequired ? ['polish',] : []),
      ...(tenseRecorded ? ['tenseCandidates',] : []),
    ],
    path,
  },);
  /**
   Terminal the artifact names, before it is known to be a name this reader
   holds.
   */
  const { terminal, } = record;
  if (!isTerminalName(terminal,)) {
    throw new ArtifactParseError({
      path: `${path}.terminal`,
      reason: `one of ${
        Object.keys(TERMINAL_NAMES,)
          .join(', ',)
      }`,
    },);
  }
  /**
   Unknown proposal verdict rows.
   */
  const verdictRows = requireArray({
    value: record.verdicts,
    path: `${path}.verdicts`,
  },);
  /**
   Parsed structural verdicts.
   */
  const verdicts = verdictRows.map(function readOne(
    entry,
    at,
  ) {
    return parseVerdict({
      value: entry,
      path: `${path}.verdicts[${String(at,)}]`,
    },);
  },);
  /**
   Slice index this record answers.
   */
  const sliceIndex = requireCount({
    value: record[keys.sliceIndex],
    path: `${path}.${keys.sliceIndex}`,
  },);
  /**
   Wording the slice ships, read before the tense finding that is about it.
   */
  const shipped = parseShipped({
    value: record.shipped,
    terminal,
    path: `${path}.shipped`,
  },);
  /**
   The tense finding the record carries, none when it carries none.
   */
  const tense = parseShippedTense({
    value: record.tenseCandidates,
    shipped,
    path: `${path}.tenseCandidates`,
  },);
  return {
    sliceIndex,
    terminal,
    shipped,
    rewrapped: requireBoolean({
      value: record.rewrapped,
      path: `${path}.rewrapped`,
    },),
    demoted: requireBoolean({
      value: record.demoted,
      path: `${path}.demoted`,
    },),
    verdicts,
    gate: parseGate({
      value: record.gate,
      path: `${path}.gate`,
    },),
    ...(polishRequired
      ? {
        polish: parseConsolidationPolish({
          value: record.polish,
          path: `${path}.polish`,
          reviewRequired,
          correctionChainRequired,
          everyBodyBlockReviewed,
          quorumBasisRequired,
        },),
      }
      : {}),
    ...tense,
  };
}

//endregion Artifact consolidated slice read
