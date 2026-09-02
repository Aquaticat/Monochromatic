import {
  readWindowDial,
  resolveStragglerGraceMs,
} from './grace-override.ts';
import { STRAGGLER_GRACE_MS, } from './stage-round.ts';

//region Writer grace override
// Lets one invocation give its WRITER rounds a different straggler window than
// its reader rounds, without rebuilding and without moving a built-in.
//
// A WRITER ROUND LOSES A CANDIDATE; A READER ROUND LOSES A BALLOT. The editor,
// refiner, translate and consolidate gathers ask each seat for text, and every
// voice the window cuts is one fewer candidate for the judges to choose among.
// The critic, panel, judge, checker and probe gathers ask eight or so seats for
// a reading of text that already exists, and the last voice to arrive adds one
// ballot to seven. The two are not the same wait, and the 2026-09-01 seating
// showed why one window cannot serve both: the editor calibration seated the
// two slowest models as editors on their text, and the four-entry pass then
// ran under `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=60000` for the reader
// rounds' sake, which cut the top editor mid-reply in the pass's first editor
// round. A window sized for the eight-wide rounds unseats the writers the
// three-wide rounds were seated on.
//
// A SECOND DIAL RATHER THAN A SECOND BUILT-IN, for the reason `grace-override.ts`
// gives: the built-in window and its decision record
// (`doc/decision/translation-repair-straggler-grace.md`) are unchanged, and a
// launch that sets nothing runs every round under one window exactly as
// before. Set, the dial applies to the writer rounds alone; the reader rounds
// keep whatever `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` or the built-in gives
// them.
//
// UNSET AND BLANK BOTH MEAN "same as every other round", and anything else
// unreadable refuses as a stated refusal, by the rule `readWindowDial` holds
// for both dials.

/**
 * Environment variable overriding the writer rounds' straggler window, in
 * milliseconds.
 */
export const WRITER_GRACE_VAR = 'TRANSLATION_REPAIR_WRITER_GRACE_MS';

/**
 * Stage labels of the rounds the dial governs, as their log lines spell them.
 *
 * Listed here rather than imported from the stages, because each stage imports
 * this module to read its window and the list exists for the launch note only.
 */
export const WRITER_STAGE_LABELS: readonly string[] = [
  'editor',
  'refiner',
  'translate',
  'produceConsolidations',
];

/**
 * Reads the window the writer rounds run under.
 *
 * @param fallback - window every other round runs under, used when the dial
 * is unset or blank
 *
 * @param raw - override text; tests pass their own, and the environment read
 * supplies `''` for an absent variable, since unset and empty are alike here
 *
 * @returns Milliseconds a writer round keeps waiting on stragglers after quorum
 *
 * @throws {@link StatedRefusalError} when the override is present and is not
 * a positive finite number of milliseconds
 *
 * @example
 * ```ts
 * const writerMs = resolveWriterGraceMs({ fallback: roundMs, },);
 * ```
 */
export function resolveWriterGraceMs(
  {
    fallback,
    raw = process.env[WRITER_GRACE_VAR] ?? '',
  }: {
    readonly fallback: number;
    readonly raw?: string;
  },
): number {
  return readWindowDial({
    variable: WRITER_GRACE_VAR,
    fallback,
    raw,
    unsetMeans: 'give writer rounds the same window as every other round',
  },);
}

/**
 * Both windows of one invocation and where the writers' came from.
 *
 * @example
 * ```ts
 * const grace: WriterGrace = { writerMs: 180_000, roundMs: 60_000, source: 'writer-dial', };
 * ```
 */
export type WriterGrace = {
  /**
   * Milliseconds a writer round keeps waiting on stragglers after quorum.
   */
  readonly writerMs: number;

  /**
   * Milliseconds every other round keeps waiting, the writers' fallback.
   */
  readonly roundMs: number;

  /**
   * `writer-dial` when a launch set the writer variable; `round-window` when
   * the writers follow every other round.
   *
   * CARRIED RATHER THAN INFERRED from the two numbers differing: the two are
   * read from mutable environment, and a note that blamed the writer dial
   * because two readings taken at different moments disagreed would name an
   * override nobody made.
   */
  readonly source: 'writer-dial' | 'round-window';
};

/**
 * Reads both windows of this invocation, the round window first because the
 * writer window falls back to it.
 *
 * READ AT EACH GATHER rather than once at launch, by the path every other
 * round already takes through `runGatherRound`: the calibration adopts its own
 * window by writing the round variable after launch, and a writer round that
 * had read the environment at import time would miss it.
 *
 * @returns Both windows and the writers' source
 *
 * @throws {@link StatedRefusalError} when either dial is set to something that
 * is not a whole number of milliseconds a timer can hold; the round dial is
 * read first, so a run with both wrong hears about the round dial first
 *
 * @example
 * ```ts
 * const { writerMs, roundMs, source, } = readWriterGrace();
 * ```
 */
export function readWriterGrace(): WriterGrace {
  /**
   * Window every other round runs under.
   */
  const roundMs = resolveStragglerGraceMs({ fallback: STRAGGLER_GRACE_MS, },);

  /**
   * What the launch set for the writers, blank when it set nothing.
   */
  const written = process.env[WRITER_GRACE_VAR] ?? '';

  if (written.trim() === '') {
    return {
      writerMs: roundMs,
      roundMs,
      source: 'round-window',
    };
  }
  return {
    writerMs: resolveWriterGraceMs({
      fallback: roundMs,
      raw: written,
    },),
    roundMs,
    source: 'writer-dial',
  };
}

/**
 * Window a writer round runs under in this invocation: the writer dial when
 * set, otherwise whatever every other round runs under.
 *
 * @returns Milliseconds a writer round keeps waiting on stragglers after quorum
 *
 * @throws {@link StatedRefusalError} as {@link readWriterGrace} does
 *
 * @example
 * ```ts
 * const gather = await gatherStageVoices({ ..., stage: 'editor', graceMs: writerRoundGraceMs(), },);
 * ```
 */
export function writerRoundGraceMs(): number {
  /**
   * Both windows, of which the gather wants the writers'.
   */
  const { writerMs, } = readWriterGrace();
  return writerMs;
}

/**
 * Explains which window the writer rounds are under when a launch gave them
 * their own.
 *
 * PRINTED BY THE DRIVERS, beside the round window's own note, for the reason
 * `graceOverrideNote` gives: a run must never hide which window it ran under,
 * and a writer round that lost nobody under a longer window is exactly the
 * round the seating wants to hear about.
 *
 * @param grace - both windows and the writers' source
 *
 * @returns Note naming both windows and the stages, or nothing when the
 * writers follow every other round
 *
 * @example
 * ```ts
 * const note = writerGraceOverrideNote({ grace: readWriterGrace(), },);
 * ```
 */
export function writerGraceOverrideNote(
  { grace, }: { readonly grace: WriterGrace; },
): string {
  if (grace.source === 'round-window')
    return '';

  return `WRITER GRACE OVERRIDDEN by ${WRITER_GRACE_VAR}: writer rounds `
    + `(${WRITER_STAGE_LABELS.join(', ',)}) abandon stragglers ${String(grace.writerMs,)}ms after `
    + `quorum rather than the ${String(grace.roundMs,)}ms every other round waits`;
}

//endregion Writer grace override
