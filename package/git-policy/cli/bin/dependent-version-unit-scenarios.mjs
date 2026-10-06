/**
 Every scenario of the incumbent dependent-version unit tests, as differential cases with their assertions.

 The workspace scenarios are in `dependent-version-unit-workspaces.mjs`; the function-level ones are in
 `dependent-version-unit-functions.mjs` and `dependent-version-unit-graph.mjs`.
 The driver applies each assertion to the incumbent's result before recording it, so a transcription mistake fails
 before any comparison. Not transcribed: the plugin registration test (the native trigger table pins the triggers)
 and the worktree conflict error's constructor (the native release path is `git cli-git fix`).
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { deepStrictEqual } from 'node:assert/strict';

import {
  functionScenarios,
  publishableScenarios,
} from './dependent-version-unit-functions.mjs';
import { workspaceScenarios } from './dependent-version-unit-workspaces.mjs';

/** @typedef {import('./dependent-version-types.mjs').CaseResult} CaseResult */
/** @typedef {import('./dependent-version-types.mjs').DifferentialCase} DifferentialCase */
/** @typedef {DifferentialCase & { check: (output: CaseResult) => void }} UnitScenario */

/**
 A function-level case's assertion: the whole result, or the named fields of it.

 @param {{ expected: Record<string, unknown>, whole: boolean }} request - expected value and how to compare
 @returns {(output: CaseResult) => void} check
 */
function functionCheck({
  expected,
  whole
}) {
  return function check(output) {
    if (whole) {
      deepStrictEqual(
        output,
        expected
      );
      return;
    }
    for (const [key, value] of Object.entries(expected))
      deepStrictEqual(
        (output)[key],
        value
      );
  };
}

/**
 A function-level case with its assertion attached.

 @param {import('./dependent-version-unit-functions.mjs').UnitCase} scenario - case with its expected result
 @returns {UnitScenario} case with its assertion
 */
function withCheck(scenario) {
  const {
    expected,
    whole,
    ...differentialCase
  } = scenario;
  return {
    ...differentialCase,
    check: functionCheck({
      expected,
      whole,
    }),
  };
}

/**
 Every incumbent unit-test scenario with its assertion, in the order of the committed fixture.

 @returns {UnitScenario[]} cases
 */
export function unitScenarios() {
  return [
    ...functionScenarios()
      .map(withCheck),
    ...workspaceScenarios(),
    ...publishableScenarios()
      .map(withCheck),
  ];
}
