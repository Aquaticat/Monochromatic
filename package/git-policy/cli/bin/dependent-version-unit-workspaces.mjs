/**
 The workspace scenarios of `dependent-version-bump-policy.unit.test.ts` and `bump-dependents-worktree.unit.test.ts`,
 as differential cases with their assertions.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import {
  deepStrictEqual,
  ok,
} from 'node:assert/strict';

import { hexText } from './dependent-version-incumbent-reader.mjs';
import {
  bumpSummary,
  configFile,
  devDependent,
  findingCodes,
  findingPaths,
  manifestText,
  pair,
  raisedBase,
  runtimeDependent,
  source,
  workspace,
  workspaceResult,
  worktreeBase,
  worktreeBaseline,
} from './dependent-version-unit-workspace-parts.mjs';

/** @typedef {import('./dependent-version-types.mjs').CaseResult} CaseResult */
/** @typedef {import('./dependent-version-types.mjs').DifferentialCase} DifferentialCase */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceInput} WorkspaceInput */
/** @typedef {DifferentialCase & { check: (output: CaseResult) => void }} UnitScenario */

/**
 The workspace scenarios: name, input, and the unit test's assertion.

 @type {[string, WorkspaceInput, (output: CaseResult) => void][]}
 */
const table = [
  [
    'findDependentBumps patches runtime and bundled dependents of a hand bump and leaves others alone',
    workspace({ files: [
      configFile([
        '@s/base',
        '@s/runtime',
        '@s/bundled',
        '@s/unbundled',
        '@s/test-only'
      ]),
      raisedBase,
      runtimeDependent('2.0.0'),
      devDependent({
        name: 'bundled',
        version: '0.3.9'
      }),
      source({
        path: 'package/module/bundled/src/index.ts',
        text: "import { base } from '@s/base/ts';\n"
      }),
      devDependent({
        name: 'unbundled',
        version: '1.0.0'
      }),
      devDependent({
        name: 'test-only',
        version: '1.0.0'
      }),
      source({
        path: 'package/module/test-only/src/index.unit.test.ts',
        text: "import '@s/base';\n"
      })
    ] }),
    function check(output) {
      deepStrictEqual(
        findingPaths(output),
        [
          'package/module/bundled/package.json',
          'package/module/runtime/package.json'
        ]
      );
      deepStrictEqual(
        findingCodes(output),
        [
          'dependent-version-stale',
          'dependent-version-stale'
        ]
      );
      const { policy } = workspaceResult(output);
      ok((policy.kind === 'findings')
        && hexText(policy.findings[1]
          ?.patch
          ?.replacement
          ?? '')
        .includes('  "version": "2.0.1"'));
    },
  ],
  [
    'findDependentBumps stays silent for git add of a hand bump',
    workspace({
      files: pair,
      forwardsCommit: false
    }),
    function check(output) {
    deepStrictEqual(
      findingPaths(output),
      []
    );
  }
  ],
  [
    'findDependentBumps reports the same hand bump on commit',
    workspace({ files: pair }),
    function check(output) {
    deepStrictEqual(
      findingPaths(output)
        .length,
      1
    );
  }
  ],
  [
    'findDependentBumps proposes dependent bumps during direct fix',
    workspace({
      files: pair,
      trigger: 'direct-fix',
      forwardsCommit: false
    }),
    function check(output) {
    deepStrictEqual(
      findingPaths(output),
      ['package/module/runtime/package.json']
    );
  }
  ],
  [
    'findDependentBumps returns nothing when no manifest version changed',
    workspace({ files: [
      configFile([
        '@s/base',
        '@s/runtime'
      ]),
      {
        path: 'package/module/base/package.json',
        text: manifestText({
          name: '@s/base',
          version: '1.0.0',
          description: 'x'
        }),
        headText: manifestText({
          name: '@s/base',
          version: '1.0.0'
        })
      },
      runtimeDependent('2.0.0')
    ] }),
    function check(output) {
      deepStrictEqual(
        findingPaths(output),
        []
      );
    },
  ],
  [
    'findDependentBumps returns nothing for a configuration alone',
    workspace({ files: [configFile([])] }),
    function check(output) {
    deepStrictEqual(
      findingPaths(output),
      []
    );
  }
  ],
  [
    'findDependentBumps settles once dependents are bumped',
    workspace({ files: [
      configFile([
        '@s/base',
        '@s/runtime'
      ]),
      raisedBase,
      {
        path: 'package/module/runtime/package.json',
        text: manifestText({
          name: '@s/runtime',
          version: '2.0.1',
          dependencies: { '@s/base': 'workspace:*' }
        }),
        headText: manifestText({
          name: '@s/runtime',
          version: '2.0.0',
          dependencies: { '@s/base': 'workspace:*' }
        })
      }
    ] }),
    function check(output) {
      deepStrictEqual(
        findingPaths(output),
        []
      );
    },
  ],
  [
    'findDependentBumps reports a dependent whose prerelease version cannot be bumped automatically',
    workspace({ files: [
      configFile([
        '@s/base',
        '@s/runtime'
      ]),
      raisedBase,
      runtimeDependent('2.0.0-rc.1')
    ] }),
    function check(output) {
      deepStrictEqual(
        findingCodes(output),
        ['dependent-version-unsupported']
      );
      const { policy } = workspaceResult(output);
      ok((policy.kind === 'findings') && (policy.findings[0]
        ?.patch
        === null));
    },
  ],
  [
    'findDependentBumps ignores a bump when the pnpr config is absent',
    workspace({ files: [
      raisedBase,
      runtimeDependent('2.0.0')
    ] }),
    function check(output) {
    deepStrictEqual(
      findingPaths(output),
      []
    );
  }
  ],
  [
    'bumpWorktreeDependents writes bumps for runtime and bundled dependents of a worktree bump',
    workspace({
      files: [
        ...worktreeBaseline,
        worktreeBase('1.1.0')
      ],
      trigger: 'direct-fix',
      forwardsCommit: false
    }),
    function check(output) {
      deepStrictEqual(
        bumpSummary(output),
        [
          '@s/app@2.0.1',
          '@s/tool@0.1.1'
        ]
      );
      const { plan } = workspaceResult(output);
      ok((plan.kind === 'planned')
        && (plan.bumpedNames
          .join(",")
          === '@s/base')
        && hexText(plan.bumps[1]
          ?.replacement
          ?? '')
        .includes('"version": "0.1.1"'));
    },
  ],
  [
    'bumpWorktreeDependents changes nothing when no manifest differs from the base',
    workspace({
      files: [
        ...worktreeBaseline,
        worktreeBase('1.0.0')
      ],
      trigger: 'direct-fix',
      forwardsCommit: false
    }),
    function check(output) {
    deepStrictEqual(
      bumpSummary(output),
      []
    );
  }
  ],
];

/**
 The workspace scenarios with their assertions.

 @returns {UnitScenario[]} cases
 */
export function workspaceScenarios() {
  return table.map(function toScenario([name, input, check]) {
    return {
      name,
      kind: 'workspace',
      input,
      check,
    };
  });
}
