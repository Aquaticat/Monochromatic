/**
 Building blocks of the workspace scenarios of the incumbent dependent-version unit tests: fixture files written as
 the incumbent tests write them, and views of a workspace result that the assertions compare.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { ok } from 'node:assert/strict';

import {
  hexText,
  toHex,
} from './dependent-version-incumbent-reader.mjs';

/** @typedef {import('./dependent-version-types.mjs').CaseResult} CaseResult */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceResult} WorkspaceResult */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceInput} WorkspaceInput */
/** @typedef {{ path: string, text: string, headText?: string }} ScenarioFile */

/**
 A manifest serialized as the incumbent fixtures serialize one.

 @param {Record<string, unknown>} manifest - manifest object
 @returns {string} two-space JSON with a final newline
 */
export function manifestText(manifest) {
  return `${JSON.stringify(
    manifest,
    undefined,
    2,
  )}\n`;
}

/**
 An unchanged manifest file.

 @param {{ directory: string, manifest: Record<string, unknown> }} request - package directory and manifest object
 @returns {ScenarioFile} file
 */
function unchangedManifest({
  directory,
  manifest
}) {
  const text = manifestText(manifest);
  return {
    path: `${directory}/package.json`,
    text,
    headText: text,
  };
}

/**
 The generated registry configuration as the policy test's `configFile` writes it.

 @param {readonly string[]} names - publishable names
 @returns {ScenarioFile} file
 */
export function configFile(names) {
  const items = names.map(function toItem(name) {
    return `            - '${name}'`;
  });
  const text = `auth:\n  oidc:\n    - workloads:\n        - registry: r\n          packages:\n${items.join('\n')}\n\nweb:\n  enable: false\n`;
  return {
    path: 'package/config/pnpr/config.yaml',
    text,
    headText: text,
  };
}

/**
 A workspace case input; candidates are the files whose text differs from `HEAD`, as `contextOf` derives them.

 @param {{ files: readonly ScenarioFile[], trigger?: string, forwardsCommit?: boolean }} request - files and lifecycle
 @returns {WorkspaceInput} input
 */
export function workspace({
  files,
  trigger = 'pre-forward',
  forwardsCommit = true
}) {
  return {
    workspace: null,
    files: files.map(function toFile(entry) {
      return {
        path: toHex(entry.path),
        mode: 'regular',
        current: toHex(entry.text),
        base: entry.headText === undefined ? null : (entry.headText === entry.text ? true : toHex(entry.headText)),
      };
    }),
    trigger,
    forwardsCommit,
    candidates: files
      .filter(function isChanged(entry) {
        return entry.text !== entry.headText;
      })
      .map(function toCandidate(entry) {
        return {
          path: toHex(entry.path),
          change: entry.headText === undefined ? 'added' : 'modified',
        };
      }),
  };
}

/** The raised base manifest of the policy tests. */
export const raisedBase = {
  path: 'package/module/base/package.json',
  text: manifestText({
    name: '@s/base',
    version: '1.1.0'
  }),
  headText: manifestText({
    name: '@s/base',
    version: '1.0.0'
  }),
};

/**
 The policy tests' runtime dependent.

 @param {string} version - its version
 @returns {ScenarioFile} file
 */
export function runtimeDependent(version) {
  return unchangedManifest({
    directory: 'package/module/runtime',
    manifest: {
      name: '@s/runtime',
      version,
      dependencies: { '@s/base': 'workspace:*' }
    },
  });
}

/**
 A development dependent of `@s/base`.

 @param {{ name: string, version: string }} request - package name suffix and version
 @returns {ScenarioFile} file
 */
export function devDependent({
  name,
  version
}) {
  return unchangedManifest({
    directory: `package/module/${name}`,
    manifest: {
      name: `@s/${name}`,
      version,
      devDependencies: { '@s/base': 'workspace:*' }
    },
  });
}

/**
 An unchanged source file.

 @param {{ path: string, text: string }} request - path and text
 @returns {ScenarioFile} file
 */
export function source({
  path,
  text
}) {
  return {
    path,
    text,
    headText: text,
  };
}

/**
 The workspace result of a case, which every workspace check reads.

 @param {CaseResult} output - case result
 @returns {WorkspaceResult} workspace result
 */
export function workspaceResult(output) {
  ok('plan' in output);
  return output;
}

/**
 Decoded finding paths of a policy result, or nothing when the policy failed.

 @param {CaseResult} output - case result
 @returns {string[]} finding paths
 */
export function findingPaths(output) {
  const { policy } = workspaceResult(output);
  ok(policy.kind === 'findings');
  return policy.findings
    .map(function decode(finding) {
    return hexText(finding.path ?? '');
  });
}

/**
 Codes of a policy result's findings.

 @param {CaseResult} output - case result
 @returns {string[]} codes
 */
export function findingCodes(output) {
  const { policy } = workspaceResult(output);
  ok(policy.kind === 'findings');
  return policy.findings
    .map(function code(finding) {
    return finding.code;
  });
}

/**
 Name and new version of every planned bump.

 @param {CaseResult} output - case result
 @returns {string[]} `name@to` per bump
 */
export function bumpSummary(output) {
  const { plan } = workspaceResult(output);
  ok(plan.kind === 'planned');
  return plan.bumps
    .map(function summary(bump) {
    return `${bump.name}@${bump.to}`;
  });
}

/** The worktree test's baseline without the base manifest. */
export const worktreeBaseline = [
  source({
    path: 'package/config/pnpr/config.yaml',
    text: "packages:\n  - '@s/app'\n  - '@s/base'\n  - '@s/tool'\nnext: 1\n"
  }),
  unchangedManifest({
    directory: 'package/module/app',
    manifest: {
      name: '@s/app',
      version: '2.0.0',
      dependencies: { '@s/base': 'workspace:*' }
    }
  }),
  unchangedManifest({
    directory: 'package/module/tool',
    manifest: {
      name: '@s/tool',
      version: '0.1.0',
      devDependencies: { '@s/base': 'workspace:*' }
    }
  }),
  source({
    path: 'package/module/tool/src/index.ts',
    text: "export { base } from '@s/base/ts';\n"
  }),
];

/**
 The worktree test's base manifest at a version.

 @param {string} version - current version
 @returns {ScenarioFile} file
 */
export function worktreeBase(version) {
  return {
    path: 'package/module/base/package.json',
    text: manifestText({
      name: '@s/base',
      version
    }),
    headText: manifestText({
      name: '@s/base',
      version: '1.0.0'
    }),
  };
}

/** The pair of the policy tests' short cases. */
export const pair = [
  configFile([
    '@s/base',
    '@s/runtime'
  ]),
  raisedBase,
  runtimeDependent('2.0.0'),
];
