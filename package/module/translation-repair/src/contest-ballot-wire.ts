import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { JUDGE_POLICY_BLOCK, } from './house-policy.ts';

//region Contest ballot wire
// The parts every two-way contest shares: the question, the reply schema, and
// the reading that narrows a judge's findings to the candidates they blame.
//
// EXTRACTED RATHER THAN COPIED when the consolidation gate needed the same
// question over a different pair of candidate names. The lane contest measured
// 10 of 13 against the eight-entry reading where a general-preference control
// managed 8; a second copy of that wording would drift from the one that number
// describes, and the number would go on being quoted.
//
// THE POLICY NAMES NO CANDIDATE. It speaks of "two English renderings" and
// "each candidate" throughout, which is what makes it shareable: the names live
// in the user message and in the reply instruction, where the caller puts them.

/**
 * Answer a judge gives when neither candidate is better.
 *
 * A VERDICT, not a failure to answer. Two candidates that differ only in
 * wording have no better one, and a judge forced to pick would be inventing a
 * preference the evidence does not carry.
 */
export const CONTEST_REFUSAL = 'neither';

/**
 * What every two-way contest tells its judges.
 *
 * THE ORIGINAL IS THE STANDARD, per `doc/decision/translation-repair-output-goal.md`.
 * The archive rendering is shown as EVIDENCE about what the original says and a
 * starting point worth keeping where it is right, never as the thing a
 * candidate is scored against. Accurate detail the archive adds is kept rather
 * than stripped, which is the one place a candidate may exceed the original.
 */
export const CONTEST_POLICY: string = [
  'You are choosing which of two English renderings of a Chinese passage should be published.',
  '',
  'THE ORIGINAL IS THE STANDARD. Judge each candidate against the Chinese, never against the archive rendering.',
  'The archive rendering is shown only as evidence about what the original says, and as wording worth keeping where it is right.',
  '',
  'Answer two questions about each candidate first, and let the choice follow from them.',
  '',
  'UNSUPPORTED: does the candidate state something the Chinese does not say?',
  'An invented time period, an invented characterisation, a strengthened claim: all unsupported.',
  'A detail the archive supplies that the Chinese does not contradict, such as a name or a spelled-out referent, is NOT unsupported: keeping it is correct.',
  '',
  'DROPPED: does the candidate omit something the Chinese does say?',
  'A clause, a qualifier, a named object, a speaker aside: all dropped.',
  '',
  'DECLARED NAMES ARE ATTESTED FACTS about this person, taken from the documents\' own front matter.',
  'Where the passage refers to this person, a candidate carrying a declared name or handle is NOT unsupported, even where the Chinese only says "she".',
  'They settle HOW to spell a name the passage already refers to, and they OUTRANK the archive rendering where the two spell the same person or place differently.',
  'They are NOT content a passage owes: a candidate that does not name this person has dropped nothing, and a line attributing the passage to someone ELSE never takes this person\'s name.',
  '',
  JUDGE_POLICY_BLOCK,
  '',
  'THEN CHOOSE. Prefer the candidate with no unsupported statements. If both are clean, prefer the one that drops nothing.',
  `Answer "${CONTEST_REFUSAL}" when they differ only in wording and neither is more faithful, which is a real verdict rather than a failure to answer.`,
  `Answer "${CONTEST_REFUSAL}" also when both are equally unfaithful.`,
].join('\n',);

/**
 * Builds the reply schema one contest asks for.
 *
 * NAMED PER CONTEST, because the schema name is what a provider log and a
 * degradation finding call this stage, and two stages sharing one name are two
 * stages nobody can tell apart afterwards.
 *
 * @param schemaName - name this contest's replies are recorded under
 *
 * @returns Response format for the round
 *
 * @example
 * ```ts
 * const format = contestResponseFormat({ schemaName: 'lane_contest', },);
 * ```
 */
export function contestResponseFormat(
  { schemaName, }: { readonly schemaName: string; },
): JsonSchemaResponseFormat {
  return {
    type: 'json_schema',
    json_schema: {
      name: schemaName,
      schema: {
        type: 'object',
        properties: {
          choice: { type: 'string', },
          unsupported: {
            type: 'array',
            items: { type: 'string', },
          },
          dropped: {
            type: 'array',
            items: { type: 'string', },
          },
          reason: { type: 'string', },
        },
        required: [
          'choice',
          'unsupported',
          'dropped',
          'reason',
        ],
      },
    },
  };
}

/**
 * Whether a value is a list of strings, whatever those strings say.
 *
 * SHAPE, NOT VOCABULARY. An earlier form of the lane contest's guard demanded
 * that every member name a candidate, so a judge that filled the findings with
 * the offending phrases instead lost its whole ballot, choice included. Two of
 * the first sixty calibration voices went that way, both carrying a usable
 * choice. The choice is the thing a contest counts, and no wording of a finding
 * may cost a voice.
 *
 * @param value - list from a reply
 *
 * @returns Whether it is a list of strings
 *
 * @example
 * ```ts
 * const shaped = isStringList([ 'repair', ],);
 * ```
 */
export function isStringList(value: unknown,): value is readonly string[] {
  return Array.isArray(value,)
    && value.every(function isText(member: unknown,): boolean {
      return ((typeof member) === 'string');
    },);
}

/**
 * Whether a value is one of the names this contest allows.
 *
 * RETURNS A PLAIN BOOLEAN rather than narrowing, because a type predicate has
 * to name a parameter and this one reads a property of a destructured object.
 * Each contest wraps it in its own one-line predicate over its own union.
 *
 * @param value - candidate name from a reply
 *
 * @param names - names this contest allows
 *
 * @returns Whether the value is one of them
 *
 * @example
 * ```ts
 * const allowed = namesOneOf({ value: 'repair', names: [ 'repair', 'translate', ], },);
 * ```
 */
export function namesOneOf(
  {
    value,
    names,
  }: {
    readonly value: unknown;
    readonly names: readonly string[];
  },
): boolean {
  return ((typeof value) === 'string')
    && names.includes(value,);
}

/**
 * Whether the character at one offset could continue a word.
 *
 * READS PAST THE END SAFELY, because `charAt` answers an empty string beyond
 * the last index and an empty string continues nothing. A candidate name
 * filling a finding entirely therefore needs no separate case.
 *
 * @param text - finding being read
 *
 * @param at - offset just past a candidate name
 *
 * @returns Whether the character there extends that name into a longer word
 *
 * @example
 * ```ts
 * const continues = continuesWord({ text: 'repairing', at: 'repair'.length, },);
 * ```
 */
function continuesWord(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): boolean {
  /**
   * Case-folded character at that offset, empty past the end.
   */
  const folded = text
    .charAt(at,)
    .toLowerCase();
  return (((folded >= 'a') && (folded <= 'z'))
    || ((folded >= '0') && (folded <= '9')));
}

/**
 * Whether one finding blames one candidate.
 *
 * ANNOTATION IS NOT REFUSAL. Judges write `repair`, and they write
 * `repair (changes the bottle to a can)`, and both name the same candidate.
 * A finding naming a phrase rather than a candidate blames nobody, and says so
 * by matching none of them.
 *
 * @param finding - what a judge wrote
 *
 * @param name - candidate to test for
 *
 * @returns Whether this finding names this candidate
 *
 * @example
 * ```ts
 * const blamed = namesCandidate({ finding: 'repair (adds a season)', name: 'repair', },);
 * ```
 */
function namesCandidate(
  {
    finding,
    name,
  }: {
    readonly finding: string;
    readonly name: string;
  },
): boolean {
  /**
   * Finding with surrounding space and case removed.
   */
  const folded = finding
    .trim()
    .toLowerCase();
  return (folded.startsWith(name,)
    && (!continuesWord({
      text: folded,
      at: name.length,
    },)));
}

/**
 * Reads which candidates a list of findings blames.
 *
 * @param findings - findings exactly as a judge wrote them
 *
 * @param names - candidate names this contest allows, in canonical order
 *
 * @returns Names blamed, in that order and without repeats
 *
 * @example
 * ```ts
 * const blamed = readCandidateNames({ findings: [ 'repair (adds a season)', ], names, },);
 * ```
 */
export function readCandidateNames<NameT extends string,>(
  {
    findings,
    names,
  }: {
    readonly findings: readonly string[];
    readonly names: readonly NameT[];
  },
): readonly NameT[] {
  return names.filter(function blamed(name,): boolean {
    return findings.some(function namesIt(finding,): boolean {
      return namesCandidate({
        finding,
        name,
      },);
    },);
  },);
}

//endregion Contest ballot wire
