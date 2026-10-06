/**
 Samples of the real repository's dependency graph and the cases that raise their versions.

 Samples are chosen from the actual graph, four per category: leaf packages (no manifest names them), the most
 depended-on packages (by runtime fields), private packages that something depends on, and packages reached only
 through bundled development imports whose importer is published.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import {
  importsPackage,
  isNonTestSourcePath,
  readPublishableNames,
} from '@monochromatic-dev/git-policy-repository/ts';

import {
  HarnessError,
  toHex,
} from './dependent-version-incumbent-reader.mjs';
import { seeded } from './dependent-version-random.mjs';
import {
  configPath,
  isManifestPath,
} from './dependent-version-repository.mjs';

/** @typedef {import('./dependent-version-repository.mjs').Snapshot} Snapshot */
/** @typedef {import('./dependent-version-types.mjs').CorpusCase} CorpusCase */
/**
 A manifest's facts as the samples need them.

 @typedef {{
   path: string,
   directory: string,
   text: string,
   name: string,
   version: string,
   private: boolean,
   runtime: string[],
   dev: string[],
 }} SampleManifest
 */
/** @typedef {{ category: string, names: string[] }} Sample */
/** @typedef {{ name: string, names: string[], trigger: string }} RaiseRequest */

/** Samples per category. */
const perCategory = 4;
/** Runtime dependency fields. */
const runtimeFields = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];

/**
 Whether parsed JSON is an object.

 @param {unknown} value - parsed JSON
 @returns {value is Record<string, unknown>} whether it is
 */
function isRecord(value) {
  return (value !== null) && ((typeof value) === 'object')
    && (!Array.isArray(value));
}

/**
 A manifest text, parsed.

 @param {{ path: string, text: string }} request - manifest path and text
 @returns {Record<string, unknown>} manifest object
 */
function parsedManifest({
  path,
  text
}) {
  /** @type {unknown} */
  const value = JSON.parse(text);
  if (!isRecord(value))
    throw new HarnessError(`${path} is not a JSON object`);
  return value;
}

/**
 The keys of one dependency field of a parsed manifest.

 @param {{ manifest: Record<string, unknown>, field: string }} request - parsed manifest and field
 @returns {string[]} names
 */
function keysOf({
  manifest,
  field
}) {
  const value = manifest[field];
  return isRecord(value) ? Object.keys(value) : [];
}

/**
 Every versioned workspace manifest at `HEAD`.

 @param {Snapshot} snapshot - repository snapshot
 @returns {SampleManifest[]} manifests
 */
function manifests(snapshot) {
  return snapshot.entries
    .filter(function isManifest(entry) {
      return isManifestPath(entry.path);
    })
    .map(function toManifest(entry) {
      const text = snapshot.bytes
        .get(entry.path)
        ?.toString('utf8')
        ?? '';
      const manifest = parsedManifest({
        path: entry.path,
        text,
      });
      return {
        path: entry.path,
        directory: entry.path
          .slice(
            0,
            -'/package.json'.length
          ),
        text,
        name: (typeof manifest.name) === 'string' ? manifest.name : '',
        version: (typeof manifest.version) === 'string' ? manifest.version : '',
        private: manifest.private === true,
        runtime: runtimeFields.flatMap(function names(field) {
          return keysOf({
            manifest,
            field,
          });
        }),
        dev: keysOf({
          manifest,
          field: 'devDependencies',
        }),
      };
    })
    .filter(function versioned(manifest) {
      return manifest.version !== '';
    });
}

/**
 Order two manifests by name, by UTF-16 code units.

 @param {SampleManifest} left - one manifest
 @param {SampleManifest} right - other manifest
 @returns {number} order
 */
function byName(
  left,
  right
) {
  return left.name < right.name ? -1 : 1;
}

/**
 Up to `perCategory` names from a list, in a seeded order after sorting by name.

 @param {{ list: SampleManifest[], random: () => number }} request - candidates and generator
 @returns {string[]} names
 */
function sample({
  list,
  random
}) {
  const ordered = [...list].sort(byName)
    .map(function withOrder(manifest) {
      return {
        name: manifest.name,
        order: random(),
      };
    });
  return ordered
    .sort(function byOrder(
      left,
      right
    ) {
      return left.order - right.order;
    })
    .slice(
      0,
      perCategory
    )
    .map(function nameOf(entry) {
      return entry.name;
    });
}

/**
 How many manifests name a package in a runtime field.

 @param {{ all: SampleManifest[], name: string }} request - manifests and package name
 @returns {number} count
 */
function runtimeCount({
  all,
  name
}) {
  return all.filter(function names(manifest) {
    return manifest.runtime
      .includes(name);
  })
    .length;
}

/**
 How many manifests name a package in any dependency field.

 @param {{ all: SampleManifest[], name: string }} request - manifests and package name
 @returns {number} count
 */
function anyCount({
  all,
  name
}) {
  return all.filter(function names(manifest) {
    return manifest.runtime
      .includes(name)
      || manifest.dev
      .includes(name);
  })
    .length;
}

/**
 Whether a non-test source file of a package imports a name.

 @param {{ snapshot: Snapshot, user: SampleManifest, name: string }} request - repository snapshot, importing
   package and imported name
 @returns {boolean} whether it does
 */
function importedBy({
  snapshot,
  user,
  name
}) {
  return [...snapshot.bytes].some(function imports([path, bytes]) {
    return isNonTestSourcePath({
      directory: user.directory,
      path,
    }) && importsPackage({
      sourceText: bytes.toString('utf8'),
      packageName: name,
    });
  });
}

/**
 Whether a package is reached only through a published package's bundled development import.

 @param {{ snapshot: Snapshot, all: SampleManifest[], publishable: Set<string>, candidate: SampleManifest }}
   request - repository snapshot, manifests, publishable names and candidate package
 @returns {boolean} whether it is
 */
function isImportOnly({
  snapshot,
  all,
  publishable,
  candidate
}) {
  return (runtimeCount({
    all,
    name: candidate.name
  }) === 0) && all.some(function publishedImporter(user) {
    return publishable.has(user.name)
      && user.dev
      .includes(candidate.name)
      && importedBy({
      snapshot,
      user,
      name: candidate.name,
    });
  });
}

/**
 The most depended-on packages by runtime fields, ties by name.

 @param {SampleManifest[]} all - manifests
 @returns {string[]} names
 */
function mostDependedOn(all) {
  return [...all]
    .sort(function byDependents(
      left,
      right
    ) {
      return (runtimeCount({
        all,
        name: right.name
      }) - runtimeCount({
        all,
        name: left.name
      })) || byName(
        left,
        right
      );
    })
    .slice(
      0,
      perCategory
    )
    .map(function nameOf(manifest) {
      return manifest.name;
    });
}

/**
 Sample packages by category from the actual graph.

 @param {{ snapshot: Snapshot, seed: number }} request - repository snapshot and sample seed
 @returns {Sample[]} samples
 */
export function repositorySamples({
  snapshot,
  seed
}) {
  const all = manifests(snapshot);
  const publishable = new Set(readPublishableNames(snapshot.bytes
    .get(configPath)
    ?.toString('utf8')
    ?? ''));
  const random = seeded(seed);
  const leaves = all.filter(function leaf(manifest) {
    return anyCount({
      all,
      name: manifest.name
    }) === 0;
  });
  const privates = all.filter(function dependedPrivate(manifest) {
    return manifest.private && (anyCount({
      all,
      name: manifest.name
    }) > 0);
  });
  const importOnly = all.filter(function importOnlyCandidate(candidate) {
    return isImportOnly({
      snapshot,
      all,
      publishable,
      candidate,
    });
  });
  return [
    {
      category: 'leaf',
      names: sample({
        list: leaves,
        random
      }),
    },
    {
      category: 'most-depended-on',
      names: mostDependedOn(all),
    },
    {
      category: 'private',
      names: sample({
        list: privates,
        random
      }),
    },
    {
      category: 'source-import-only',
      names: sample({
        list: importOnly,
        random
      }),
    },
  ];
}

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

 @param {{ byName: Map<string, SampleManifest>, workspaceFile: string, request: RaiseRequest }} context - manifests
   by name, shared workspace file name, and the case's name, raised packages and lifecycle
 @returns {CorpusCase} case
 */
function raiseCase({
  byName: manifestsByName,
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
  const byName = new Map(manifests(snapshot)
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
      byName,
      workspaceFile,
      request,
    });
  });
}
