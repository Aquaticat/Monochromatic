/**
 Comparison of one probe's outcome between the incumbent and the native wrapper.

 Output is compared byte for byte after the fixture root is masked; the one native event the incumbent never emits
 (the notice that a legacy configuration file sits beside the JSONC file) is checked and removed first.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import * as v from 'valibot';

import { leftBehind } from './differential-config-fixture.mjs';
import { DifferentialError } from './differential-config-process.mjs';
import { UNPORTED_POLICIES } from './differential-config-scenarios.mjs';

/**
 What one probe showed, by comparison.

 @typedef {{ label: string, status: 'equal' | 'pending' | 'different', detail: string }} Row
 */

/**
 Replace a fixture's root path so output of two fixtures compares equal.

 @param {{ text: string, root: string }} request - output and the root to mask
 @returns {string} output with every root occurrence replaced
 */
function masked({
  text,
  root,
}) {
  return text.replaceAll(
    root,
    '<root>',
  );
}

/**
 One event line of the wrappers' JSONL output: an object whose keys keep the order the wrapper wrote them in,
 so that serializing it again reproduces the original bytes.

 @typedef {Record<string, unknown>} EventLine
 */

/** An event line is an object of any fields. */
const eventSchema = v.record(
  v.string(),
  v.unknown(),
);

/**
 Whether an event is the native wrapper's notice that the incumbent's `cli-git.config.ts` sits beside the JSONC file.

 @param {EventLine} event - one parsed event
 @returns {boolean} true for the legacy-configuration notice
 */
function isLegacyNotice(event) {
  return (event.type === 'configuration-warning') && (event.code === 'legacy-config-ignored');
}

/**
 Remove the native wrapper's legacy-configuration notice from `git cli-git check` output and renumber the events
 after it.
 `check` reports a legacy file by design during the rollback period (user decision of 2026-10-05), and the incumbent
 has no counterpart, so the notice is the one native event the incumbent never emits.
 It must be present exactly once and first, or the removal would hide a missing or misplaced report.

 @param {string} text - standard output of the native `check`
 @returns {string} the output without the notice
 */
function withoutLegacyNotice(text) {
  const events = text
    .split('\n')
    .filter(function nonEmpty(line) {
      return line !== '';
    })
    .map(function parse(line) {
      return v.parse(
        eventSchema,
        JSON.parse(line),
      );
    });
  const notices = events.filter(isLegacyNotice);
  const [first] = events;
  const leads = (first !== undefined) && isLegacyNotice(first);
  const exactlyOne = notices.length === 1;
  if (!(exactlyOne && leads))
    throw new DifferentialError(
      `The native check must print exactly one legacy-configuration notice, first; it printed: ${text}`,
    );
  return events
    .slice(1)
    .map(function renumbered(event) {
      const { sequence } = event;
      const shifted = (typeof sequence) === 'number'
        ? {
          ...event,
          sequence: sequence - 1,
        }
        : event;
      return `${JSON.stringify(shifted)}\n`;
    })
    .join('');
}

/**
 Whether a native result is the refusal for an unported policy, and for which.

 @param {import('./differential-config-process.mjs').Observed} native - native outcome
 @returns {string | undefined} the policy name, or undefined for any other outcome
 */
function unportedPolicyOf(native) {
  const {
    code,
    stderr,
  } = native;
  if (code !== 2)
    return undefined;
  return UNPORTED_POLICIES.find(function isNamed(policy) {
    return stderr.includes(`which the policy ${policy} needs,`);
  });
}

/**
 Fail when a candidate set stops isolating the policy it is named for: the incumbent must report that policy's
 finding on `check --policy <it>` and no other policy's.

 @param {{
   scenario: import('./differential-config-scenarios.mjs').Scenario,
   probe: import('./differential-config-scenarios.mjs').Probe,
   incumbent: import('./differential-config-process.mjs').Observed,
 }} request - candidates, the probe that ran and the incumbent's outcome
 */
function requireIsolation({
  scenario,
  probe,
  incumbent,
}) {
  const [
    ,
    command,
    flag,
    policy,
  ] = probe.args;
  if ((command !== 'check') || (flag !== '--policy'))
    return;
  const { stdout } = incumbent;
  const expected = policy === scenario.triggers;
  const found = stdout.includes(`"policyId":"${policy}"`);
  if (expected !== found)
    throw new DifferentialError(
      `Scenario ${scenario.name}: the incumbent's ${probe.label} ${found ? 'found something' : 'found nothing'}, `
        + `so the scenario no longer isolates ${scenario.triggers}. Output: ${incumbent.stdout}`,
    );
}

/**
 Run one probe in both fixtures and compare what each wrapper decided.

 @param {{
   scenario: import('./differential-config-scenarios.mjs').Scenario,
   probe: import('./differential-config-scenarios.mjs').Probe,
   forIncumbent: import('./differential-config-fixture.mjs').Fixture,
   forNative: import('./differential-config-fixture.mjs').Fixture,
 }} request - candidates, the probe and the two fixtures
 @returns {Promise<Row>} the comparison
 */
export async function compareProbe({
  scenario,
  probe,
  forIncumbent,
  forNative,
}) {
  const incumbent = await forIncumbent.incumbent(probe.args);
  const native = await forNative.native(probe.args);
  requireIsolation({
    scenario,
    probe,
    incumbent,
  });
  const pending = unportedPolicyOf(native);
  const isCheck = (probe.args[0] === 'cli-git') && (probe.args[1] === 'check');
  const incumbentText = {
    ...incumbent,
    stdout: masked({
      text: incumbent.stdout,
      root: forIncumbent.root,
    }),
    stderr: masked({
      text: incumbent.stderr,
      root: forIncumbent.root,
    }),
  };
  const nativeText = {
    ...native,
    stdout: masked({
      text: (isCheck && (pending === undefined))
        ? withoutLegacyNotice(native.stdout)
        : native.stdout,
      root: forNative.root,
    }),
    stderr: masked({
      text: native.stderr,
      root: forNative.root,
    }),
  };
  const [
    incumbentLeft,
    nativeLeft,
  ] = probe.mutates
    ? await Promise.all([
      leftBehind({
        fixture: forIncumbent,
        scenario,
      }),
      leftBehind({
        fixture: forNative,
        scenario,
      }),
    ])
    : [
      '',
      '',
    ];
  const sameLeft = incumbentLeft === nativeLeft;
  const sameDecision = JSON.stringify(incumbentText) === JSON.stringify(nativeText);
  const same = sameDecision && sameLeft;
  const status = same
    ? 'equal'
    : pending === undefined
    ? 'different'
    : 'pending';
  const decisions = `incumbent ${JSON.stringify(incumbentText)} native ${JSON.stringify(nativeText)}`;
  const leftovers = ` left behind: incumbent ${JSON.stringify(incumbentLeft)} native ${JSON.stringify(nativeLeft)}`;
  return {
    label: `${scenario.name}: ${probe.label}`,
    status,
    detail: same
      ? `exit ${incumbent.code}`
      : `${decisions}${sameLeft ? '' : leftovers}`,
  };
}
