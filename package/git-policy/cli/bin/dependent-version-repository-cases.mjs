/**
 Cases of the dependent-version differential harness that raise sampled packages' versions in the real repository.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import {
  HarnessError,
  toHex,
} from './dependent-version-incumbent-reader.mjs';
import {
  manifests,
  parsedManifest,
} from './dependent-version-repository-samples.mjs';

/** @typedef {import('./dependent-version-repository.mjs').Snapshot} Snapshot */
/** @typedef {import('./dependent-version-types.mjs').CorpusCase} CorpusCase */
/** @typedef {import('./dependent-version-repository-samples.mjs').SampleManifest} SampleManifest */
/** @typedef {import('./dependent-version-repository-samples.mjs').Sample} Sample */
/** @typedef {{ name: string, names: string[], trigger: string }} RaiseRequest */

/**
 The manifest text with its version raised by one minor step.

 @param {SampleManifest} manifest - manifest
 @returns {string} raised text
 */
function raisedText(manifest) {
  const [major = '', minor = ''] = manifest.version
    .split('.');
  const raised = `${major}.${String(Number(minor) + 1)}.0`;
  const text = manifest.text
    .replace(
    `"version": ${JSON.stringify(manifest.version)}`,
    `"version": ${JSON.stringify(raised)}`,
  );
  if (parsedManifest({
    path: manifest.path,
    text
  })
    .version
    !== raised)
    throw new HarnessError(`could not raise ${manifest.path}`);
  return text;
}

/**
 A case raising some packages' versions in the real workspace.

 @param {{ manifestsByName: Map<string, SampleManifest>, workspaceFile: string, request: RaiseRequest }} context -
   manifests by name, shared workspace file name, and the case's name, raised packages and lifecycle
 @returns {CorpusCase} case
 */
function raiseCase({
  manifestsByName,
  workspaceFile,
  request
}) {
  const raised = request.names
    .map(function manifestOf(raisedName) {
    const found = manifestsByName.get(raisedName);
    if (found === undefined)
      throw new HarnessError(`no manifest named ${raisedName}`);
    return found;
  });
  return {
    name: request.name,
    kind: 'workspace',
    label: 'repository',
    features: [],
    input: {
      workspace: workspaceFile,
      files: raised.map(function toFile(manifest) {
        return {
          path: toHex(manifest.path),
          mode: 'regular',
          current: toHex(raisedText(manifest)),
          base: toHex(manifest.text),
        };
      }),
      trigger: request.trigger,
      forwardsCommit: request.trigger === 'pre-forward',
      candidates: raised.map(function toCandidate(manifest) {
        return {
          path: toHex(manifest.path),
          change: 'modified',
        };
      }),
    },
  };
}

/**
 Cases raising sampled packages: one per sample, one raising one of each category, and that raise as the release
 workflow's direct fix.

 @param {{ snapshot: Snapshot, samples: Sample[], workspaceFile: string }} request - repository snapshot, sampled
   names, and the shared workspace file name
 @returns {CorpusCase[]} cases
 */
export function repositoryCases({
  snapshot,
  samples,
  workspaceFile
}) {
  const manifestsByName = new Map(manifests(snapshot)
    .map(function entry(manifest) {
    return [
      manifest.name,
      manifest,
    ];
  }));
  const mixed = samples.flatMap(function first(entry) {
    return entry.names
      .slice(
        0,
        1
      );
  });
  /** @type {RaiseRequest[]} */
  const requests = [
    ...samples.flatMap(function single({
      category,
      names
    }) {
      return names.map(function raiseOne(name) {
        return {
          name: `repository ${category} ${name}`,
          names: [name],
          trigger: 'pre-forward',
        };
      });
    }),
    {
      name: `repository mixed ${mixed.join(' ')}`,
      names: mixed,
      trigger: 'pre-forward',
    },
    {
      name: `repository release-shaped direct fix ${mixed.join(' ')}`,
      names: mixed,
      trigger: 'direct-fix',
    },
  ];
  return requests.map(function toCase(request) {
    return raiseCase({
      manifestsByName,
      workspaceFile,
      request,
    });
  });
}
