import type { RosterModelId, } from '../roster-id.ts';
import { ROSTER_MODEL_IDS, } from '../roster-reach.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { RUN_ROSTER, } from './run-config.ts';

//region Probe candidates
// WHICH SEATABLE MODELS A PROBE MEASURES BESIDE THE SEATED ONES, read off the
// command line.
//
// THE RUN ROSTER IS THE MEASURED ROSTER. Since 2026-09-01 a model takes a role
// on the numbers `judge-fidelity-probe` and `producer-calibrate` report, and
// since 2026-09-07 the roster names two sizes nobody has measured, the Gemma 4
// sizes only Amazon Bedrock serves. Those stay out of `RUN_ROSTER` until the
// probes have read them, and the probes ran the run roster, so nothing could
// ever measure them: a seat that needs a number to be taken could not be asked
// for one.
//
// `--candidates` BREAKS THAT CIRCLE. It names seatable ids, comma separated,
// that join the probe's roster for that run only: they judge beside the seated
// judges in the fidelity probe, and write and judge beside the seated roster in
// the calibration. Nothing outside the probes reads it. A name the roster does
// not know is refused with the names it does, because a probe that quietly ran
// without the model it was started for would print a clean standing over the
// wrong roster, which is the failure `asked-count.ts` exists to stop.

/**
 * Flag the candidate ids are written after.
 */
const CANDIDATES_FLAG = '--candidates';

/**
 * Reads seatable ids named after `--candidates`.
 *
 * @param argv - process arguments, passed rather than read so this is testable
 * without a subprocess
 *
 * @returns Candidate ids in the order written, none when the flag is absent
 *
 * @throws StatedRefusalError when the flag carries no id, or names one the
 * roster does not know
 *
 * @example
 * ```ts
 * const candidates = readCandidateIds({ argv: process.argv, },);
 * ```
 */
export function readCandidateIds(
  { argv, }: { readonly argv: readonly string[]; },
): readonly RosterModelId[] {
  /**
   * Where the flag was written, absent when it was not.
   */
  const flagAt = argv.indexOf(CANDIDATES_FLAG,);
  if (flagAt === (-1))
    return [];

  /**
   * Ids as written after the flag, split on commas, blanks dropped.
   */
  const written = (argv[flagAt + 1] ?? '')
    .split(',',)
    .filter(function isNamed(id,): boolean {
      return id !== '';
    },);
  if (written.length === 0) {
    throw new StatedRefusalError({
      says: `${CANDIDATES_FLAG} takes seatable ids, comma separated: ${ROSTER_MODEL_IDS.join(',',)}`,
    },);
  }

  return written.map(function seatable(id,): RosterModelId {
    /**
     * Roster spelling this id matches, absent when the roster knows no such id.
     */
    const known = ROSTER_MODEL_IDS.find(function is(rosterId,): boolean {
      return rosterId === id;
    },);
    if (known === undefined) {
      throw new StatedRefusalError({
        says: `${CANDIDATES_FLAG} names ${id}, which is not seatable; the roster knows ${ROSTER_MODEL_IDS.join(',',)}`,
      },);
    }
    return known;
  },);
}

/**
 * Roster a probe runs: the seated roster, then every candidate it does not
 * already seat, in the order the candidates were named.
 *
 * @param candidates - ids read by {@link readCandidateIds}
 *
 * @returns Seated roster followed by the candidates new to it
 *
 * @example
 * ```ts
 * const roster = probeRosterWith({ candidates: readCandidateIds({ argv: process.argv, },), },);
 * ```
 */
export function probeRosterWith(
  { candidates, }: { readonly candidates: readonly RosterModelId[]; },
): readonly RosterModelId[] {
  /**
   * Candidates the seated roster does not already carry, each once.
   */
  const joining = candidates.filter(function isNew(
    candidate,
    at,
  ): boolean {
    return (!RUN_ROSTER.includes(candidate,)) && (candidates.indexOf(candidate,) === at);
  },);
  return [
    ...RUN_ROSTER,
    ...joining,
  ];
}

//endregion Probe candidates
