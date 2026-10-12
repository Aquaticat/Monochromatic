/**
 Seeded cases for the dependent-version differential harness: the main generated class, whose results must be
 identical, and the probe class, each probe carrying one feature whose result is meant to differ.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { toHex } from './dependent-version-incumbent-reader.mjs';
import {
  seeded,
  tools,
} from './dependent-version-random.mjs';
import {
  generatedWorkspace,
  probeFeatures,
} from './dependent-version-workspace.mjs';

/** @typedef {import('./dependent-version-random.mjs').Tool} Tool */
/** @typedef {import('./dependent-version-types.mjs').CorpusCase} CorpusCase */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceInput} WorkspaceInput */
/** @typedef {import('./dependent-version-workspace.mjs').GeneratedFile} GeneratedFile */
/** @typedef {import('./dependent-version-workspace.mjs').GeneratedWorkspace} GeneratedWorkspace */

/** The byte-order mark. */
const byteOrderMark = Buffer.from(
  '\uFEFF',
  'utf8',
);

/** The configuration path. */
const configPath = 'package/config/pnpr/config.yaml';

/**
 Apply a probe feature that acts on bytes.

 @param {{ tool: Tool, feature: string, files: GeneratedFile[] }} request - choices, feature, and files changed in
   place
 */
function applyByteFeature({
  tool,
  feature,
  files
}) {
  const manifests = files.filter(function isManifest(entry) {
    return entry.path
      .endsWith('/package.json');
  });
  const target = tool.pick(manifests);
  const same = (target.base !== undefined)
    && target.base
    .equals(target.current);
  if (feature === 'bom') {
    target.current = Buffer.concat([
      byteOrderMark,
      target.current
    ]);
    if (target.base !== undefined)
      target.base = same ? target.current : Buffer.concat([
        byteOrderMark,
        target.base
      ]);
  }
  if (feature === 'non-utf8-manifest') {
    const open = target.current
      .indexOf('{');
    target.current = Buffer.concat([
      target.current
        .subarray(
          0,
          open + 1
        ),
      Buffer.from(
        '"bad":"\u00FF",',
        'latin1'
      ),
      target.current
        .subarray(open + 1)
    ]);
  }
  const config = files.find(function isConfig(entry) {
    return entry.path === configPath;
  });
  if ((feature === 'non-utf8-config') && (config !== undefined))
    config.current = Buffer.concat([
      Buffer.from(
        '# \u00FF\n',
        'latin1'
      ),
      config.current
    ]);
}

/**
 A workspace as a differential case input.

 @param {GeneratedWorkspace} generated - workspace
 @returns {WorkspaceInput} input
 */
function caseInput(generated) {
  const changed = generated.files
    .filter(function isChanged(entry) {
    return (entry.base === undefined) || (!entry.current
      .equals(entry.base));
  });
  return {
    workspace: null,
    files: generated.files
      .map(function toFile(entry) {
      return {
        path: toHex(entry.path),
        mode: entry.mode,
        current: toHex(entry.current),
        base: entry.base === undefined ? null : (entry.base
          .equals(entry.current) ? true : toHex(entry.base)),
      };
    }),
    trigger: generated.trigger,
    forwardsCommit: generated.forwardsCommit,
    candidates: [
      ...changed.map(function toCandidate(entry) {
        return {
          path: toHex(entry.path),
          change: entry.base === undefined ? 'added' : 'modified'
        };
      }),
      ...(generated.deleted ? [{
        path: toHex('package/module/gone/package.json'),
        change: 'deleted'
      }] : []),
    ],
  };
}

/**
 The main generated class: workspaces whose results must be identical.

 @param {{ seed: number, count: number }} request - seed and number of workspaces
 @returns {CorpusCase[]} cases
 */
export function generatedCases({
  seed,
  count
}) {
  const tool = tools(seeded(seed));
  return Array.from(
    { length: count },
    function generated(
      _,
      index
    ) {
    return {
      name: `generated ${String(seed)}/${String(index)}`,
      kind: 'workspace',
      input: caseInput(generatedWorkspace({
        tool,
        defect: true,
        feature: undefined
      })),
      label: 'generated',
      features: [],
    };
  }
  );
}

/** Mixes the seed so probes draw a sequence of their own. */
const probeSeedMix = 0x5F_37_59_DF;

/**
 The probe class: one deliberate difference per workspace.

 @param {{ seed: number, perFeature: number }} request - seed and workspaces per feature
 @returns {CorpusCase[]} cases
 */
export function probeCases({
  seed,
  perFeature
}) {
  const tool = tools(seeded(seed ^ probeSeedMix));
  return probeFeatures.flatMap(function casesOf(feature) {
    return Array.from(
      { length: perFeature },
      function probe(
        _,
        index
      ) {
      const generated = generatedWorkspace({
        tool,
        defect: false,
        feature
      });
      applyByteFeature({
        tool,
        feature,
        files: generated.files
      });
      return {
        name: `probe ${feature} ${String(seed)}/${String(index)}`,
        kind: 'workspace',
        input: caseInput(generated),
        label: 'probe',
        features: [feature],
      };
    }
    );
  });
}
