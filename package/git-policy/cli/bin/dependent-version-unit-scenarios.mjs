/**
 Every scenario of the incumbent dependent-version unit tests, as differential cases.

 Sources, all under `package/git-policy/repository/src`:
 `dependent-version-bump.unit.test.ts`, `manifest-text.unit.test.ts`, `source-imports.unit.test.ts`,
 `dependent-version-bump-policy.unit.test.ts` and `bump-dependents-worktree.unit.test.ts`.
 Each case keeps the unit test's own assertion as `check`, which the driver applies to the incumbent's result
 before recording it, so a transcription mistake fails before any comparison.
 Not transcribed: the plugin registration test (the native trigger table pins the triggers),
 and the worktree conflict error's constructor (the native release path is `git cli-git fix`).
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { deepStrictEqual, ok } from 'node:assert/strict';

import { toHex } from './dependent-version-incumbent.mjs';

/**
 A manifest serialized as the incumbent fixtures serialize one.

 @param {Record<string, unknown>} manifest - manifest object
 @returns {string} two-space JSON with a final newline
 */
function manifestText(manifest) {
  return `${JSON.stringify(manifest, undefined, 2)}\n`;
}

/**
 A fixture file; `headText` absent for a new file.

 @param {string} path - repository path
 @param {string} text - current text
 @param {string} [headText] - `HEAD` text
 @returns {{ path: string, text: string, headText?: string }} file
 */
function file(path, text, headText) {
  return { path, text, ...(headText === undefined ? {} : { headText }) };
}

/**
 An unchanged manifest file.

 @param {string} directory - package directory
 @param {Record<string, unknown>} manifest - manifest object
 @returns {{ path: string, text: string, headText: string }} file
 */
function unchangedManifest(directory, manifest) {
  const text = manifestText(manifest);
  return { path: `${directory}/package.json`, text, headText: text };
}

/**
 The generated registry configuration as the policy test's `configFile` writes it.

 @param {readonly string[]} names - publishable names
 @returns {{ path: string, text: string, headText: string }} file
 */
function configFile(names) {
  const text = `auth:\n  oidc:\n    - workloads:\n        - registry: r\n          packages:\n${names.map(name => `            - '${name}'`).join('\n')}\n\nweb:\n  enable: false\n`;
  return { path: 'package/config/pnpr/config.yaml', text, headText: text };
}

/**
 A workspace case input; candidates are the files whose text differs from `HEAD`, as `contextOf` derives them.

 @param {readonly { path: string, text: string, headText?: string }[]} files - fixture files
 @param {{ trigger?: string, forwardsCommit?: boolean }} [options] - lifecycle
 @returns {object} input
 */
function workspace(files, { trigger = 'pre-forward', forwardsCommit = true } = {}) {
  return {
    workspace: null,
    files: files.map(entry => ({
      path: toHex(entry.path),
      mode: 'regular',
      current: toHex(entry.text),
      base: entry.headText === undefined ? null : (entry.headText === entry.text ? true : toHex(entry.headText)),
    })),
    trigger,
    forwardsCommit,
    candidates: files
      .filter(entry => entry.text !== entry.headText)
      .map(entry => ({ path: toHex(entry.path), change: entry.headText === undefined ? 'added' : 'modified' })),
  };
}

/** The raised base manifest of the policy tests. */
const raisedBase = file(
  'package/module/base/package.json',
  manifestText({ name: '@s/base', version: '1.1.0' }),
  manifestText({ name: '@s/base', version: '1.0.0' }),
);

/**
 The policy tests' runtime dependent.

 @param {string} version - its version
 @returns {{ path: string, text: string, headText: string }} file
 */
function runtimeDependent(version) {
  return unchangedManifest('package/module/runtime', { name: '@s/runtime', version, dependencies: { '@s/base': 'workspace:*' } });
}

/**
 Paths of the policy findings, decoded.

 @param {any} output - canonical workspace result
 @returns {string[]} finding paths
 */
function findingPaths(output) {
  return output.policy.findings.map((/** @type {any} */ finding) => Buffer.from(finding.path, 'hex').toString('utf8'));
}

/**
 Function-level and workspace scenarios of `dependent-version-bump.unit.test.ts`.

 @returns {object[]} cases
 */
function bumpScenarios() {
  const manifest = (/** @type {string} */ name, /** @type {string | null} */ version, /** @type {string[]} */ edgeNames = []) => ({ name, directory: `package/module/${name}`, version, edgeNames });
  return [
    { name: 'patchBumpVersion increments 1.2.3', kind: 'patchBumpVersion', input: { name: 'a', version: '1.2.3' }, check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'ok', value: '1.2.4' }) },
    { name: 'patchBumpVersion increments 0.0.9', kind: 'patchBumpVersion', input: { name: 'a', version: '0.0.9' }, check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'ok', value: '0.0.10' }) },
    ...['1.0.0-alpha.1', '1.0.0+build', '01.0.0', '1.0', '1.0.x', ''].map(version => ({
      name: `patchBumpVersion rejects ${JSON.stringify(version)}`,
      kind: 'patchBumpVersion',
      input: { name: '@scope/a', version },
      check: (/** @type {any} */ out) => deepStrictEqual(out.kind, 'unsupported'),
    })),
    {
      name: 'planDependentBumps bumps direct and transitive publishable dependents in name order',
      kind: 'planDependentBumps',
      input: { manifests: [manifest('z-app', '2.0.0', ['mid']), manifest('mid', '1.0.0', ['base']), manifest('base', '1.1.0'), manifest('a-tool', '0.1.0', ['base'])], bumpedNames: ['base'], publishableNames: ['z-app', 'mid', 'base', 'a-tool'] },
      check: (/** @type {any} */ out) => deepStrictEqual(out.value.map((/** @type {any} */ bump) => `${bump.name}@${bump.to}`), ['a-tool@0.1.1', 'mid@1.0.1', 'z-app@2.0.1']),
    },
    {
      name: 'planDependentBumps walks through unpublishable packages but bumps only publishable ones',
      kind: 'planDependentBumps',
      input: { manifests: [manifest('app', '1.0.0', ['internal']), manifest('internal', '1.0.0', ['base']), manifest('base', '1.0.0')], bumpedNames: ['base'], publishableNames: ['app', 'base'] },
      check: (/** @type {any} */ out) => deepStrictEqual(out.value, [{ name: 'app', directory: 'package/module/app', from: '1.0.0', to: '1.0.1' }]),
    },
    {
      name: 'planDependentBumps skips already bumped and versionless dependents',
      kind: 'planDependentBumps',
      input: { manifests: [manifest('bumped-dependent', '3.0.0', ['base']), manifest('versionless', null, ['base']), manifest('base', '1.0.0')], bumpedNames: ['base', 'bumped-dependent'], publishableNames: ['bumped-dependent', 'versionless', 'base'] },
      check: (/** @type {any} */ out) => deepStrictEqual(out.value, []),
    },
    {
      name: 'planDependentBumps ignores external and self edges and terminates on cycles',
      kind: 'planDependentBumps',
      input: { manifests: [manifest('left', '1.0.0', ['right', 'left', 'external']), manifest('right', '1.0.0', ['left'])], bumpedNames: ['left'], publishableNames: ['left', 'right'] },
      check: (/** @type {any} */ out) => deepStrictEqual(out.value, [{ name: 'right', directory: 'package/module/right', from: '1.0.0', to: '1.0.1' }]),
    },
    {
      name: 'planDependentBumps returns nothing when no package was bumped',
      kind: 'planDependentBumps',
      input: { manifests: [manifest('a', '1.0.0', ['b'])], bumpedNames: [], publishableNames: ['a'] },
      check: (/** @type {any} */ out) => deepStrictEqual(out.value, []),
    },
    {
      name: 'planDependentBumps throws when a dependent needing a bump has a prerelease version',
      kind: 'planDependentBumps',
      input: { manifests: [manifest('a', '1.0.0-rc.1', ['b']), manifest('b', '1.0.0')], bumpedNames: ['b'], publishableNames: ['a', 'b'] },
      check: (/** @type {any} */ out) => deepStrictEqual(out.kind, 'unsupported'),
    },
  ];
}

/**
 Scenarios of `manifest-text.unit.test.ts` and `source-imports.unit.test.ts`.

 @returns {object[]} cases
 */
function textScenarios() {
  const formatted = '{\n  "name": "a",\n  "description": "version \\"x\\"",\n  "publishConfig": { "version": "9.9.9" },\n  "version" :  "1.0.0",\n  "tail": ["version"]\n}\n';
  return [
    {
      name: 'readManifestDependencyFacts reads name, version, runtime fields in order, and development names',
      kind: 'readManifestDependencyFacts',
      input: { path: 'package.json', text: JSON.stringify({ name: '@scope/a', version: '1.0.0', dependencies: { '@scope/b': 'workspace:*' }, peerDependencies: { '@scope/c': '*' }, optionalDependencies: { '@scope/d': '*' }, devDependencies: { '@scope/e': 'workspace:*' } }) },
      check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'facts', name: '@scope/a', version: '1.0.0', runtime: ['@scope/b', '@scope/c', '@scope/d'], dev: ['@scope/e'] }),
    },
    {
      name: 'readManifestDependencyFacts omits an absent version and treats non-object dependency fields as empty',
      kind: 'readManifestDependencyFacts',
      input: { path: 'package.json', text: '{"name":"a","dependencies":["b"]}' },
      check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'facts', name: 'a', version: null, runtime: [], dev: [] }),
    },
    ...[['[]', 'is not a JSON object'], ['{"version":"1.0.0"}', 'has no string "name"'], ['{"name":"a","version":1}', 'has a non-string "version"']].map(([text, message]) => ({
      name: `readManifestDependencyFacts rejects manifest that ${message}`,
      kind: 'readManifestDependencyFacts',
      input: { path: 'package/module/a/package.json', text },
      check: (/** @type {any} */ out) => deepStrictEqual(out.error, 'shape'),
    })),
    {
      name: 'replaceManifestVersion changes only the top-level version value and keeps formatting',
      kind: 'replaceManifestVersion',
      input: { path: 'package.json', text: formatted, from: '1.0.0', to: '1.0.1' },
      check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'ok', value: formatted.replace('"version" :  "1.0.0"', '"version" :  "1.0.1"') }),
    },
    ...[['{"version":"2.0.0"}', 'declares a different version'], ['{"name":"a","nested":{"version":"1.0.0"}}', 'has no top-level version'], ['{"version":1}', 'has a non-string version'], ['{"name":"a', 'ends inside a string literal']].map(([text, reason]) => ({
      name: `replaceManifestVersion rejects manifest that ${reason}`,
      kind: 'replaceManifestVersion',
      input: { path: 'package.json', text, from: '1.0.0', to: '1.0.1' },
      check: (/** @type {any} */ out) => deepStrictEqual(out.error, 'shape'),
    })),
    ...["import { a } from '@scope/b';", 'import type { A } from "@scope/b/ts";', "import '@scope/b';", "export * from '@scope/b';", "const m = await import('@scope/b');", 'const m = await import ( `@scope/b/sub` );', "const m = require('@scope/b');", "import { a }\nfrom\n'@scope/b';", "const note = '@scope/b';\nimport { a } from '@scope/b';"].map(sourceText => ({
      name: `importsPackage detects ${JSON.stringify(sourceText)}`,
      kind: 'importsPackage',
      input: { sourceText, packageName: '@scope/b' },
      check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'bool', value: true }),
    })),
    ...["import { a } from '@scope/bc';", "const name = '@scope/b';", "reimport '@scope/b';", "myrequire('@scope/b');", "import { a } from 'x@scope/b';", '@scope/b', ''].map(sourceText => ({
      name: `importsPackage ignores ${JSON.stringify(sourceText)}`,
      kind: 'importsPackage',
      input: { sourceText, packageName: '@scope/b' },
      check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'bool', value: false }),
    })),
    ...[['package/module/a/src/index.ts', true], ['package/module/a/src/deep/view.tsx', true], ['package/module/a/src/index.unit.test.ts', false], ['package/module/a/src/README.md', false], ['package/module/a/test/index.ts', false], ['package/module/ab/src/index.ts', false]].map(([path, expected]) => ({
      name: `isNonTestSourcePath ${expected ? 'accepts' : 'rejects'} ${path}`,
      kind: 'isNonTestSourcePath',
      input: { directory: 'package/module/a', path },
      check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'bool', value: expected }),
    })),
  ];
}

/**
 Scenarios of `dependent-version-bump-policy.unit.test.ts` and `bump-dependents-worktree.unit.test.ts`.

 @returns {object[]} cases
 */
function workspaceScenarios() {
  const base = raisedBase;
  const pair = [configFile(['@s/base', '@s/runtime']), base, runtimeDependent('2.0.0')];
  const worktreeBaseline = [
    file('package/config/pnpr/config.yaml', "packages:\n  - '@s/app'\n  - '@s/base'\n  - '@s/tool'\nnext: 1\n", "packages:\n  - '@s/app'\n  - '@s/base'\n  - '@s/tool'\nnext: 1\n"),
    unchangedManifest('package/module/app', { name: '@s/app', version: '2.0.0', dependencies: { '@s/base': 'workspace:*' } }),
    unchangedManifest('package/module/tool', { name: '@s/tool', version: '0.1.0', devDependencies: { '@s/base': 'workspace:*' } }),
    file('package/module/tool/src/index.ts', "export { base } from '@s/base/ts';\n", "export { base } from '@s/base/ts';\n"),
  ];
  const baseAt = (/** @type {string} */ version) => file('package/module/base/package.json', manifestText({ name: '@s/base', version }), manifestText({ name: '@s/base', version: '1.0.0' }));
  return [
    {
      name: 'findDependentBumps patches runtime and bundled dependents of a hand bump and leaves others alone',
      input: workspace([
        configFile(['@s/base', '@s/runtime', '@s/bundled', '@s/unbundled', '@s/test-only']),
        base,
        runtimeDependent('2.0.0'),
        unchangedManifest('package/module/bundled', { name: '@s/bundled', version: '0.3.9', devDependencies: { '@s/base': 'workspace:*' } }),
        file('package/module/bundled/src/index.ts', "import { base } from '@s/base/ts';\n", "import { base } from '@s/base/ts';\n"),
        unchangedManifest('package/module/unbundled', { name: '@s/unbundled', version: '1.0.0', devDependencies: { '@s/base': 'workspace:*' } }),
        unchangedManifest('package/module/test-only', { name: '@s/test-only', version: '1.0.0', devDependencies: { '@s/base': 'workspace:*' } }),
        file('package/module/test-only/src/index.unit.test.ts', "import '@s/base';\n", "import '@s/base';\n"),
      ]),
      check: (/** @type {any} */ out) => {
        deepStrictEqual(findingPaths(out), ['package/module/bundled/package.json', 'package/module/runtime/package.json']);
        ok(out.policy.findings.every((/** @type {any} */ finding) => finding.code === 'dependent-version-stale'));
        ok(Buffer.from(out.policy.findings[1].patch.replacement, 'hex').toString('utf8').includes('  "version": "2.0.1"'));
      },
    },
    { name: 'findDependentBumps stays silent for git add of a hand bump', input: workspace(pair, { forwardsCommit: false }), check: (/** @type {any} */ out) => deepStrictEqual(out.policy.findings, []) },
    { name: 'findDependentBumps reports the same hand bump on commit', input: workspace(pair), check: (/** @type {any} */ out) => deepStrictEqual(out.policy.findings.length, 1) },
    { name: 'findDependentBumps proposes dependent bumps during direct fix', input: workspace(pair, { trigger: 'direct-fix', forwardsCommit: false }), check: (/** @type {any} */ out) => deepStrictEqual(findingPaths(out), ['package/module/runtime/package.json']) },
    {
      name: 'findDependentBumps returns nothing when no manifest version changed',
      input: workspace([configFile(['@s/base', '@s/runtime']), file('package/module/base/package.json', manifestText({ name: '@s/base', version: '1.0.0', description: 'x' }), manifestText({ name: '@s/base', version: '1.0.0' })), runtimeDependent('2.0.0')]),
      check: (/** @type {any} */ out) => deepStrictEqual(out.policy.findings, []),
    },
    { name: 'findDependentBumps returns nothing for a configuration alone', input: workspace([configFile([])]), check: (/** @type {any} */ out) => deepStrictEqual(out.policy.findings, []) },
    {
      name: 'findDependentBumps settles once dependents are bumped',
      input: workspace([configFile(['@s/base', '@s/runtime']), base, file('package/module/runtime/package.json', manifestText({ name: '@s/runtime', version: '2.0.1', dependencies: { '@s/base': 'workspace:*' } }), manifestText({ name: '@s/runtime', version: '2.0.0', dependencies: { '@s/base': 'workspace:*' } }))]),
      check: (/** @type {any} */ out) => deepStrictEqual(out.policy.findings, []),
    },
    {
      name: 'findDependentBumps reports a dependent whose prerelease version cannot be bumped automatically',
      input: workspace([configFile(['@s/base', '@s/runtime']), base, runtimeDependent('2.0.0-rc.1')]),
      check: (/** @type {any} */ out) => {
        deepStrictEqual(out.policy.findings.map((/** @type {any} */ finding) => finding.code), ['dependent-version-unsupported']);
        deepStrictEqual(out.policy.findings[0].patch, null);
      },
    },
    { name: 'findDependentBumps ignores a bump when the pnpr config is absent', input: workspace([base, runtimeDependent('2.0.0')]), check: (/** @type {any} */ out) => deepStrictEqual(out.policy.findings, []) },
    {
      name: 'bumpWorktreeDependents writes bumps for runtime and bundled dependents of a worktree bump',
      input: workspace([...worktreeBaseline, baseAt('1.1.0')], { trigger: 'direct-fix', forwardsCommit: false }),
      check: (/** @type {any} */ out) => {
        deepStrictEqual(out.plan.bumpedNames, ['@s/base']);
        deepStrictEqual(out.plan.bumps.map((/** @type {any} */ bump) => `${bump.name}@${bump.to}`), ['@s/app@2.0.1', '@s/tool@0.1.1']);
        ok(Buffer.from(out.plan.bumps[1].replacement, 'hex').toString('utf8').includes('"version": "0.1.1"'));
      },
    },
    {
      name: 'bumpWorktreeDependents changes nothing when no manifest differs from the base',
      input: workspace([...worktreeBaseline, baseAt('1.0.0')], { trigger: 'direct-fix', forwardsCommit: false }),
      check: (/** @type {any} */ out) => deepStrictEqual(out.plan.bumps, []),
    },
  ].map(scenario => ({ ...scenario, kind: 'workspace' }));
}

/**
 Every incumbent unit-test scenario with its assertion.

 @returns {{ name: string, kind: string, input: object, check: (output: any) => void }[]} cases
 */
export function unitScenarios() {
  const publishable = [
    ["a: 1\n  packages:\n    - '@s/a'\n    - '@s/b'\n  other: x\n    - '@s/c'\n", ['@s/a', '@s/b']],
    ["packages:\n  - '@s/a'", ['@s/a']],
    ['no list here\n', []],
    ["packages:\n  - ''\n", []],
  ].map(([configText, names]) => ({
    name: `readPublishableNames reads ${JSON.stringify(configText)}`,
    kind: 'readPublishableNames',
    input: { configText },
    check: (/** @type {any} */ out) => deepStrictEqual(out, { kind: 'names', value: names }),
  }));
  return /** @type {any} */ ([...bumpScenarios(), ...textScenarios(), ...workspaceScenarios(), ...publishable]);
}
