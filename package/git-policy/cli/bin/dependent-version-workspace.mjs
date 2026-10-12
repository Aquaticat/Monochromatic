/**
 One seeded workspace for the dependent-version differential harness: packages with random edges of every field kind,
 their manifests at both states, source files, the registry configuration and the lifecycle, with at most one
 malformed manifest, and the probe features that act on package facts.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import {
  configText,
  generatedPackage,
  sourceFiles,
} from './dependent-version-generator-parts.mjs';
import { malformed } from './dependent-version-malformed.mjs';
import { manifestStates } from './dependent-version-manifest-text.mjs';


/** @typedef {import('./dependent-version-random.mjs').Tool} Tool */
/** @typedef {import('./dependent-version-manifest-text.mjs').GeneratedPackage} GeneratedPackage */
/** @typedef {import('./dependent-version-types.mjs').CorpusCase} CorpusCase */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceInput} WorkspaceInput */
/** @typedef {{ path: string, mode: string, current: Buffer, base: Buffer | undefined }} GeneratedFile */
/**
 A generated workspace before it becomes a case.

 @typedef {{ files: GeneratedFile[], trigger: string, forwardsCommit: boolean, deleted: boolean }} GeneratedWorkspace
 */

/** Dependency fields, weighted by repetition. */
const fields = [
  'dependencies',
  'dependencies',
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'devDependencies',
  'devDependencies',
  'devDependencies'
];
/** Specifier values, including every workspace protocol form. */
const protocols = [
  'workspace:*',
  'workspace:^',
  'workspace:~',
  'workspace:^1.2.3',
  '^1.0.0',
  '1.0.0',
  'npm:@g/alias@1',
  'link:../x',
  'file:../x',
  '*'
];
/** Names outside the workspace, including ones that look like workspace packages without a manifest. */
const externals = [
  'react',
  'left-pad',
  '@types/node',
  '@g/missing',
  '@g/missing/ts'
];
/** Manifest modes, weighted by repetition. */
const modes = [
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'regular',
  'executable',
  'symlink',
  'submodule'
];
/** Lifecycles, weighted by repetition: trigger and whether the forwarded command is `commit`. */
const lifecycles = /** @type {[string, boolean][]} */ ([
  [
    'pre-forward',
    true
  ],
  [
    'pre-forward',
    true
  ],
  [
    'pre-forward',
    true
  ],
  [
    'pre-forward',
    true
  ],
  [
    'pre-forward',
    true
  ],
  [
    'pre-forward',
    true
  ],
  [
    'pre-forward',
    true
  ],
  [
    'pre-forward',
    false
  ],
  [
    'direct-fix',
    false
  ],
  [
    'direct-check',
    false
  ]
]);
/** The most packages one workspace raises. */
const maximumRaised = 3;
/** How many packages are raised, weighted by repetition. */
const raisedCounts = [
  0,
  1,
  1,
  1,
  2,
  maximumRaised,
];
/** Patch components at and above 2^53 and 10^21. */
const hugeVersions = [
  '1.0.9007199254740993',
  '2.3.999999999999999999999',
  '0.1.9007199254740992'
];
/** Probabilities of the generator's events. */
const odds = {
  edge: 0.32,
  selfEdge: 0.04,
  external: 0.3,
  config: 0.92,
  published: 0.75,
  extraPublished: 0.2,
  defect: 0.1,
  defectInBase: 0.3,
  ghost: 0.2,
  deleted: 0.1,
};
/** Packages per workspace: at least this many. */
const minimumPackages = 2;
/** Packages per workspace: up to this many more. */
const extraPackages = 9;
/** The configuration path. */
const configPath = 'package/config/pnpr/config.yaml';

/** Probe features, each a deliberate difference recorded in the handover. */
export const probeFeatures = [
  'bom',
  'huge-patch',
  'duplicate-name',
  'unpaired-surrogate-name',
  'deep-nesting',
  'non-utf8-manifest',
  'non-utf8-config'
];

/**
 Packages with random edges, and the probe features that act on package facts.

 @param {{ tool: Tool, feature: string | undefined }} request - choices and probe feature
 @returns {GeneratedPackage[]} packages
 */
function generatedPackages({
  tool,
  feature
}) {
  const packages = Array.from(
    { length: minimumPackages + tool.below(extraPackages) },
    function create(
      _,
      index
    ) {
    return generatedPackage({
      tool,
      index,
    });
  }
  );
  for (const pkg of packages) {
    for (const other of packages) {
      if (tool.chance(other === pkg ? odds.selfEdge : odds.edge))
        pkg.edges
          .push({
            field: tool.pick(fields),
            name: other.name,
            protocol: tool.pick(protocols)
          });
    }
    if (tool.chance(odds.external))
      pkg.edges
        .push({
          field: tool.pick(fields),
          name: tool.pick(externals),
          protocol: tool.pick(protocols)
        });
  }
  const [first, second] = packages;
  if ((feature === 'duplicate-name') && (first !== undefined)
    && (second !== undefined))
    second.name = first.name;
  if (feature === 'unpaired-surrogate-name')
    tool.pick(packages)
      .name += '\uD800';
  if (feature === 'deep-nesting')
    tool.pick(packages)
      .deep = true;
  for (const pkg of packages)
    pkg.sources = sourceFiles({
      tool,
      pkg,
      names: packages.map(function nameOf(other) {
      return other.name;
    })
    });
  return packages;
}

/**
 The manifest file of one package, possibly malformed.

 @param {{ tool: Tool, pkg: GeneratedPackage, raised: boolean, broken: boolean }} request - choices, package,
   whether it is raised and whether it carries the workspace's one defect
 @returns {GeneratedFile} manifest file
 */
function manifestFile({
  tool,
  pkg,
  raised,
  broken
}) {
  const states = manifestStates({
    tool,
    pkg,
    raised
  });
  const breakBase = broken && (states.base !== undefined)
    && tool.chance(odds.defectInBase);
  const current = broken && (!breakBase) ? malformed({
    tool,
    text: states.current
  }) : states.current;
  const base = breakBase && (states.base !== undefined) ? malformed({
    tool,
    text: states.base
  }) : states.base;
  return {
    path: `${pkg.directory}/package.json`,
    mode: tool.pick(modes),
    current: Buffer.from(
      current,
      'utf8'
    ),
    base: base === undefined ? undefined : Buffer.from(
      base,
      'utf8'
    ),
  };
}

/**
 One generated workspace as fixture files, candidates and lifecycle.

 @param {{ tool: Tool, defect: boolean, feature: string | undefined }} request - choices, whether one manifest may be
   malformed, and the probe feature
 @returns {GeneratedWorkspace} workspace
 */
export function generatedWorkspace({
  tool,
  defect,
  feature
}) {
  const packages = generatedPackages({
    tool,
    feature
  });
  const raised = new Set(tool.shuffled(packages)
    .slice(
      0,
      tool.pick(raisedCounts)
    ));
  if (feature === 'huge-patch') {
    for (const pkg of packages.filter(function unraised(candidate) {
      return !raised.has(candidate);
    }))
      pkg.version = tool.pick(hugeVersions);
  }
  /** @type {GeneratedFile[]} */
  const files = [];
  if (tool.chance(odds.config)) {
    const published = packages.filter(function isPublished() {
      return tool.chance(odds.published);
    });
    const text = Buffer.from(
      configText({
        tool,
        names: [
          ...published.map(function nameOf(pkg) {
      return pkg.name;
    }),
          ...(tool.chance(odds.extraPublished) ? ['@g/not-here'] : [])
        ]
      }),
      'utf8'
    );
    files.push({
      path: configPath,
      mode: 'regular',
      current: text,
      base: text
    });
  }
  const broken = defect && tool.chance(odds.defect) ? tool.pick(packages) : undefined;
  for (const pkg of packages) {
    files.push(manifestFile({
      tool,
      pkg,
      raised: raised.has(pkg),
      broken: pkg === broken
    }));
    for (const source of pkg.sources)
      files.push({
        path: source.path,
        mode: 'regular',
        current: source.bytes,
        base: source.bytes
      });
  }
  if (tool.chance(odds.ghost))
    files.push({
      path: 'package/module/ghost/src/index.ts',
      mode: 'regular',
      current: Buffer.from(`import '${tool.pick(packages)
        .name}';`),
      base: undefined
    });
  const [trigger, forwardsCommit] = tool.pick(lifecycles);
  return {
    files: tool.shuffled(files),
    trigger,
    forwardsCommit,
    deleted: tool.chance(odds.deleted)
  };
}
