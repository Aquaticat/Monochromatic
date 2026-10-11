/**
 Compare the incumbent's and the native planner's canonical results per class, and count how the incumbent's results
 are distributed so a class that exercises only one path is visible.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { HarnessError } from './dependent-version-incumbent-reader.mjs';
import { explainProbe } from './dependent-version-probes.mjs';

/** @typedef {import('./dependent-version-types.mjs').CaseResult} CaseResult */
/** @typedef {import('./dependent-version-types.mjs').CorpusCase} CorpusCase */
/**
 One class's comparison.

 @typedef {{
   label: string,
   cases: number,
   identical: number,
   outcomes: Record<string, number>,
   explained: string[],
   unexplained: { name: string, incumbent: CaseResult, native: CaseResult }[],
 }} ClassReport
 */

/** Class labels in report order. */
const labels = [
  'unit',
  'repository',
  'generated',
  'probe'
];

/**
 The outcome key of a plan or function result.

 @param {CaseResult} result - incumbent result
 @returns {string[]} outcome keys
 */
function outcomeKeys(result) {
  if (!('plan' in result))
    return [`function ${result.kind}`];
  const {
    plan,
    policy
  } = result;
  const planKey = plan.kind === 'planned'
    ? (plan.bumps
      .length
      > 0 ? 'plan with bumps' : (plan.bumpedNames
        .length
        > 0 ? 'plan raised without bumps' : 'plan nothing raised'))
    : (plan.kind === 'failed' ? `plan failed ${plan.error}` : 'plan unsupported');
  const codes = policy.kind === 'findings'
    ? [...new Set(policy.findings
      .map(function code(finding) {
      return finding.code;
    }))]
    : [];
  const policyKey = policy.kind === 'failed'
    ? `policy failed ${policy.error}`
    : (codes.length > 0 ? `policy ${codes.join('+')}` : 'policy no finding');
  return [
    planKey,
    policyKey
  ];
}

/**
 Counts of outcome keys over results.

 @param {CaseResult[]} results - incumbent results
 @returns {Record<string, number>} counts by outcome
 */
function outcomes(results) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const key of results.flatMap(outcomeKeys))
    counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

/**
 Whether a parsed value can be a canonical result.

 @param {unknown} value - parsed JSON
 @returns {value is CaseResult} whether it is an object
 */
function isCaseResult(value) {
  return (value !== null) && ((typeof value) === 'object');
}

/**
 One canonical result line, parsed.

 @param {string | undefined} line - canonical JSON text
 @returns {CaseResult} result
 */
function parsedResult(line) {
  /** @type {unknown} */
  const value = JSON.parse(line ?? 'null');
  if (!isCaseResult(value))
    throw new HarnessError(`not a canonical result: ${String(line)}`);
  return value;
}

/**
 Compare both planners' results per class.

 @param {{ all: CorpusCase[], incumbent: string[], native: string[] }} request - cases and both sides' canonical
   results, one per case in the same order
 @returns {ClassReport[]} per-class comparison
 */
export function compareClasses({
  all,
  incumbent,
  native
}) {
  return labels.map(function compareClass(label) {
    const indices = [...all.keys()].filter(function inClass(index) {
      return all[index]
        ?.label
        === label;
    });
    const differing = indices.filter(function differs(index) {
      return incumbent[index] !== native[index];
    });
    const explained = differing.filter(function isExplained(index) {
      const [feature] = all[index]
        ?.features
        ?? [];
      return (feature !== undefined) && explainProbe({
        feature,
        incumbent: parsedResult(incumbent[index]),
        native: parsedResult(native[index])
      });
    });
    return {
      label,
      cases: indices.length,
      identical: indices.length - differing.length,
      outcomes: outcomes(indices.map(function result(index) {
        return parsedResult(incumbent[index]);
      })),
      explained: explained.map(function nameOf(index) {
        return all[index]
          ?.name
          ?? '';
      }),
      unexplained: differing
        .filter(function notExplained(index) {
          return !explained.includes(index);
        })
        .map(function detail(index) {
          return {
            name: all[index]
              ?.name
              ?? '',
            incumbent: parsedResult(incumbent[index]),
            native: parsedResult(native[index])
          };
        }),
    };
  });
}
