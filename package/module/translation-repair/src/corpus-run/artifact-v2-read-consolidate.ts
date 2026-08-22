import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
} from '../artifact-guard.ts';
import type {
  ArtifactConsolidateSliceV2,
  ArtifactConsolidationV2,
} from './artifact-v2-consolidate.ts';
import {
  parseGateBallot,
  parseShipped,
  parseVerdict,
} from './artifact-v2-read-consolidate-parts.ts';
import type { ConsolidationTerminal, } from '../consolidate-settle.ts';

//region Artifact version 2 consolidation read
// Reading what the third rendering settled over one document.
//
// ITS OWN FILE for the reason the pairing read is: the whole-artifact reader
// has no room under the file-length limit, and this is a subject of its own,
// with an absence carrying two meanings and a payload that decides what a
// reader ships. Its leaf shapes sit in `artifact-v2-read-consolidate-parts.ts`.
//
// EVERY REFUSAL HERE MIRRORS AN INVARIANT THE PRODUCER ALREADY HOLDS, which is
// the only kind worth enforcing on a stored record: `describeConsolidateSlice`
// writes one record per contested slice, in comparison-row order, and carries
// text on exactly the consolidated terminal.

/**
 * Ways a settlement can leave the stage, as an artifact may name them.
 */
const TERMINAL_NAMES: readonly ConsolidationTerminal[] = [
  'incumbent-only',
  'no-standing-text',
  'slate-kept-standing',
  'gate-kept-standing',
  'wrap-erased-difference',
  'consolidated',
];

/**
 * What an artifact says about the third rendering over its document.
 *
 * THREE STATES, NOT TWO. `not-run` is a pass that chose not to ask; `unrecorded`
 * is an artifact written before the field existed, which is every artifact
 * settled before this landed. Collapsing them would let a census of how often
 * the stage declines count the whole earlier archive as declines.
 *
 * @example
 * ```ts
 * const consolidation: ParsedConsolidationV2 = { kind: 'unrecorded', };
 * ```
 */
export type ParsedConsolidationV2 =
  | ArtifactConsolidationV2
  | {
    /**
     * Artifact names no consolidation, which for every artifact settled to
     * date means it was written before the field existed.
     */
    readonly kind: 'unrecorded';
  };

/**
 * Reads what the gate settled at one slice, or that it was never asked.
 *
 * @param value - gate field as the slice carries it
 *
 * @param path - dotted path for error messages
 *
 * @returns What the gate settled, or a stated absence
 *
 * @throws {@link ArtifactParseError} when the field is the wrong shape or its
 * usable count disagrees with the ballots beside it
 *
 * @example
 * ```ts
 * const gate = parseGate({ value: record.gate, path, },);
 * ```
 */
function parseGate(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactConsolidateSliceV2['gate'] {
  /**
   * Gate field as a record.
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
   * Every ballot the gate could read, in the order it recorded them.
   */
  const ballots = requireArray({
    value: record.ballots,
    path: `${path}.ballots`,
  },)
    .map(function readOne(
      entry,
      at,
    ) {
      return parseGateBallot({
        value: entry,
        path: `${path}.ballots[${String(at,)}]`,
      },);
    },);

  /**
   * Voices the gate counted, which the producer sets to the ballot count.
   */
  const usable = requireCount({
    value: record.usable,
    path: `${path}.usable`,
  },);
  if (usable !== ballots.length) {
    throw new ArtifactParseError({
      path: `${path}.usable`,
      reason: `${String(ballots.length,)}, matching the ballots recorded beside it`,
    },);
  }
  return {
    kind: 'asked',
    ballots,
    usable,
  };
}

/**
 * Reads one consolidated slice.
 *
 * @param value - slice as the artifact carries it
 *
 * @param path - dotted path for error messages
 *
 * @returns Slice this version names
 *
 * @throws {@link ArtifactParseError} when a field is missing, names a terminal
 * this version does not know, or disagrees with the terminal about whether the
 * slice ships anything
 *
 * @example
 * ```ts
 * const slice = parseConsolidateSlice({ value: entry, path, },);
 * ```
 */
function parseConsolidateSlice(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactConsolidateSliceV2 {
  /**
   * Slice as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'chunkIndex',
      'terminal',
      'shipped',
      'rewrapped',
      'demoted',
      'verdicts',
      'gate',
    ],
    path,
  },);

  /**
   * How this slice left the stage, which decides whether it ships anything.
   */
  const terminal = TERMINAL_NAMES.find(function matches(known,): boolean {
    return known === record.terminal;
  },);
  if (terminal === undefined) {
    throw new ArtifactParseError({
      path: `${path}.terminal`,
      reason: `one of ${TERMINAL_NAMES.join(', ',)}`,
    },);
  }
  return {
    chunkIndex: requireCount({
      value: record.chunkIndex,
      path: `${path}.chunkIndex`,
    },),
    terminal,
    shipped: parseShipped({
      value: record.shipped,
      terminal,
      path: `${path}.shipped`,
    },),
    rewrapped: requireBoolean({
      value: record.rewrapped,
      path: `${path}.rewrapped`,
    },),
    demoted: requireBoolean({
      value: record.demoted,
      path: `${path}.demoted`,
    },),
    verdicts: requireArray({
      value: record.verdicts,
      path: `${path}.verdicts`,
    },)
      .map(function readOne(
        entry,
        at,
      ) {
        return parseVerdict({
          value: entry,
          path: `${path}.verdicts[${String(at,)}]`,
        },);
      },),
    gate: parseGate({
      value: record.gate,
      path: `${path}.gate`,
    },),
  };
}

/**
 * Reads what the consolidation settled over one document.
 *
 * A DUPLICATE SLICE IS REFUSED, following the contest reader for the reason
 * `#113` gave: the driver writes one record per contested slice, so two records
 * naming one slice are two different answers to the same question, and a
 * consumer keying by `chunkIndex` would silently keep whichever it read last.
 *
 * @param value - consolidation field as the artifact carries it
 *
 * @param path - dotted path for error messages
 *
 * @returns What the stage settled, that it did not run, or that this artifact
 * predates the field
 *
 * @throws {@link ArtifactParseError} when the field is the wrong shape or two
 * records name one slice
 *
 * @example
 * ```ts
 * const consolidation = parseConsolidationV2({ value: artifact.consolidation, path, },);
 * ```
 */
export function parseConsolidationV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ParsedConsolidationV2 {
  if (value === undefined)
    return { kind: 'unrecorded', };

  /**
   * Consolidation field as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  if (record.kind === 'not-run') {
    requireExactKeys({
      record,
      allowed: ['kind',],
      path,
    },);
    return { kind: 'not-run', };
  }
  if (record.kind !== 'settled') {
    throw new ArtifactParseError({
      path: `${path}.kind`,
      reason: 'one of settled, not-run',
    },);
  }
  requireExactKeys({
    record,
    allowed: [
      'kind',
      'slices',
    ],
    path,
  },);

  /**
   * Every consolidated slice, in the order the driver wrote them.
   */
  const slices = requireArray({
    value: record.slices,
    path: `${path}.slices`,
  },)
    .map(function readOne(
      entry,
      at,
    ) {
      return parseConsolidateSlice({
        value: entry,
        path: `${path}.slices[${String(at,)}]`,
      },);
    },);

  /**
   * Slices already named, so a second record naming one is refused where it
   * appears rather than after the whole list has been read.
   */
  const named = new Set<number>();
  for (const slice of slices) {
    if (named.has(slice.chunkIndex,)) {
      throw new ArtifactParseError({
        path: `${path}.slices`,
        reason: `one record per slice; slice ${String(slice.chunkIndex,)} appears more than once`,
      },);
    }
    named.add(slice.chunkIndex,);
  }
  return {
    kind: 'settled',
    slices,
  };
}

//endregion Artifact version 2 consolidation read
