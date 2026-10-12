import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type {
  PresentTenseCandidate,
  PresentTenseRule,
} from '../present-tense-candidates.ts';
import type { TenseCandidateGroup, } from '../tense-candidate-block.ts';

//region Lane contest tense candidates reader
// READS THE TENSE CANDIDATES A CONTEST SLICE RECORDS (`tenseCandidates`, the
// audit finding of `artifact-two-lane-contest.ts`). Stored values are checked
// by shape before anything is returned, so a reader never hands a record it
// could not have written to the audit trail. The finding is read back as it
// was written and feeds no verdict.

/**
 Rules a recorded candidate may name, as the detector writes them.
 */
const RECORDED_RULES: readonly PresentTenseRule[] = [
  'contraction',
  'copula-or-auxiliary',
  's-ending-verb',
  'bare-verb',
];

/**
 Reads one recorded rule name, refusing any name the detector never writes.

 @param value - recorded rule name

 @param path - artifact path of the value, for the refusal

 @returns The rule name

 @throws {@link ArtifactParseError} when the name is not a rule the detector writes

 @example
 ```ts
 const rule = parseRecordedRule({ value: 'bare-verb', path: 'x.rule', },);
 ```
 */
function parseRecordedRule(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): PresentTenseRule {
  /**
   Rule name as recorded, before it is matched against those the detector writes.
   */
  const named = requireString({
    value,
    path,
  },);
  for (const rule of RECORDED_RULES) {
    if (rule === named)
      return rule;
  }
  throw new ArtifactParseError({
    path,
    reason: 'a present-tense rule the detector writes',
  },);
}

/**
 Reads one recorded candidate, checking each field's shape.

 @param value - recorded candidate

 @param path - artifact path of the value, for refusals

 @returns The candidate

 @throws {@link ArtifactParseError} when a field is missing or of the wrong shape

 @example
 ```ts
 const found = parseRecordedCandidate({ value, path: 'x.found[0]', },);
 ```
 */
function parseRecordedCandidate(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): PresentTenseCandidate {
  /**
   Candidate as a record, before its fields are read.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'sentence',
      'matched',
      'rule',
    ],
    path,
  },);
  return {
    sentence: requireString({
      value: record.sentence,
      path: `${path}.sentence`,
    },),
    matched: requireString({
      value: record.matched,
      path: `${path}.matched`,
    },),
    rule: parseRecordedRule({
      value: record.rule,
      path: `${path}.rule`,
    },),
  };
}

/**
 Reads the tense-candidate groups a contest slice records, present only where
 the record carries the field.

 @param value - recorded `tenseCandidates` value

 @param path - artifact path of the value, for refusals

 @returns Groups in recorded order

 @throws {@link ArtifactParseError} when the value is not a list of labelled candidate lists

 @example
 ```ts
 const groups = parseRecordedTenseCandidates({ value: [], path: 'x.tenseCandidates', },);
 ```
 */
export function parseRecordedTenseCandidates(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly TenseCandidateGroup[] {
  return requireArray({
    value,
    path,
  },)
    .map(function readGroup(
      group,
      position,
    ): TenseCandidateGroup {
      /**
       Path of this group within the record.
       */
      const groupPath = `${path}[${String(position,)}]`;
      /**
       Group as a record, before its fields are read.
       */
      const record = requireRecord({
        value: group,
        path: groupPath,
      },);
      requireExactKeys({
        record,
        allowed: [
          'label',
          'found',
        ],
        path: groupPath,
      },);
      return {
        label: requireString({
          value: record.label,
          path: `${groupPath}.label`,
        },),
        found: requireArray({
          value: record.found,
          path: `${groupPath}.found`,
        },)
          .map(function readFound(
            found,
            at,
          ): PresentTenseCandidate {
            return parseRecordedCandidate({
              value: found,
              path: `${groupPath}.found[${String(at,)}]`,
            },);
          },),
      };
    },);
}

//endregion Lane contest tense candidates reader
