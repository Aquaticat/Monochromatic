/**
 * Audited Node host intrinsic effects.
 *
 * @module
 */

import type {
  NodeSourceEffectAuthority,
  NodeSourceEvidence,
} from './host-effect-authority.ts';
import type {
  IntrinsicEffectEntry,
  IntrinsicProvenance,
} from './intrinsic-effect-catalog.ts';

/**
 * Exact Node 26.5.0 embedded JavaScript source identities.
 */
const NODE_SOURCES = {
  buffer: {
    nodeVersion: '26.5.0',
    module: 'buffer',
    sourceDigest: '1b15446290915577350455b136d69041b6b9900f72946ec3ef8340240c9e706b',
  },
  fileSystem: {
    nodeVersion: '26.5.0',
    module: 'fs',
    sourceDigest: '54c166b19956a792f167722bd8b7a7dcec3c9b91accc9479f8b009e11ff5d202',
  },
  fileSystemUtilities: {
    nodeVersion: '26.5.0',
    module: 'internal/fs/utils',
    sourceDigest: '36f07c79a6c2708bf4fe7b7f6cc8c7acbff3f19e80ac93cc75016fbdbda63141',
  },
  path: {
    nodeVersion: '26.5.0',
    module: 'path',
    sourceDigest: 'dd326ecdc2d6ad2025c4991f4b480d76a9f1d52b7f6d0988a5dc0a1d02de5209',
  },
  publicUrl: {
    nodeVersion: '26.5.0',
    module: 'url',
    sourceDigest: '9037c1cae0efe6af02ea18da109ff0c406496cccaf9df4c3308ef057d009150f',
  },
  url: {
    nodeVersion: '26.5.0',
    module: 'internal/url',
    sourceDigest: '5a78dbb1282692302e7eeaf75ddd48472c2b1141117cefdc169b07d5b28c5552',
  },
} as const;

/**
 * Exact installed Node declaration major audited with runtime sources.
 */
const NODE_PROVENANCE: IntrinsicProvenance = {
  kind: 'node',
  declarationMajor: 26,
};

/**
 * Creates exact Node source authority for one callable definition marker.
 *
 * @param source - Exact embedded module source identity.
 *
 * @param definitionMarker - Exact callable definition marker.
 *
 * @param occurrenceCount - Audited definition count in module source.
 *
 * @param bindingMarkers - Exact internal export or owner binding markers.
 *
 * @param relatedSources - Exact public-module import and export chain.
 *
 * @returns source and definition identity accepted by host gate.
 */
function nodeSourceAuthority({
  source,
  definitionMarker,
  occurrenceCount,
  bindingMarkers,
  relatedSources,
}: {
  readonly source: {
    readonly nodeVersion: string;
    readonly module: string;
    readonly sourceDigest: string;
  };
  readonly definitionMarker: string;
  readonly occurrenceCount: number;
  readonly bindingMarkers: readonly {
    readonly text: string;
    readonly occurrenceCount: number;
  }[];
  readonly relatedSources: readonly NodeSourceEvidence[];
}): NodeSourceEffectAuthority {
  return {
    kind: 'node-builtin-source',
    ...source,
    relatedSources,
    definitionMarkers: [
      {
        text: definitionMarker,
        occurrenceCount,
      },
      ...bindingMarkers,
    ],
  };
}

/**
 * Node effects accepted only for exact declaration,
 * embedded-source,
 * and callable-definition identities.
 */
export const NODE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: NODE_PROVENANCE,
    ownerType: 'BufferConstructor',
    member: 'concat',
    targets: [],
    evidence: 'Node 26.5.0 embedded buffer JavaScript copies validated Uint8Array values into a new Buffer',
    authority: nodeSourceAuthority({
      source: NODE_SOURCES.buffer,
      definitionMarker: '\nBuffer.concat = function concat(list, length) {',
      occurrenceCount: 1,
      bindingMarkers: [
        {
          text: '\n  Buffer,\n',
          occurrenceCount: 1,
        },
        {
          text: '\nmodule.exports = {',
          occurrenceCount: 1,
        },
      ],
      relatedSources: [],
    },),
  },
  {
    provenance: NODE_PROVENANCE,
    ownerType: 'node:buffer',
    member: 'isUtf8',
    targets: [],
    evidence: 'Node 26.5.0 embedded buffer JavaScript and native binding implementation',
    authority: nodeSourceAuthority({
      source: NODE_SOURCES.buffer,
      definitionMarker: '\nfunction isUtf8(input) {',
      occurrenceCount: 1,
      bindingMarkers: [
        {
          text: '\n  isUtf8,\n',
          occurrenceCount: 1,
        },
        {
          text: '\nmodule.exports = {',
          occurrenceCount: 1,
        },
      ],
      relatedSources: [],
    },),
  },
  ...[
    'basename',
    'dirname',
    'extname',
    'isAbsolute',
    'join',
    'matchesGlob',
    'normalize',
    'relative',
    'resolve',
    'toNamespacedPath',
  ].map(function pathObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: NODE_PROVENANCE,
      ownerType: 'node:path',
      member,
      targets: [],
      evidence: 'Node 26.5.0 embedded path JavaScript implementation',
      authority: nodeSourceAuthority({
        source: NODE_SOURCES.path,
        definitionMarker: `\n  ${member}(`,
        occurrenceCount: 2,
        relatedSources: [],
        bindingMarkers: [
          {
            text: 'const win32 = {',
            occurrenceCount: 1,
          },
          {
            text: 'const posix = {',
            occurrenceCount: 1,
          },
          {
            text: '\nmodule.exports = isWindows ? win32 : posix;',
            occurrenceCount: 1,
          },
        ],
      },),
    };
  },),
  ...[
    'isBlockDevice',
    'isCharacterDevice',
    'isDirectory',
    'isFIFO',
    'isFile',
    'isSocket',
    'isSymbolicLink',
  ].map(function direntObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: NODE_PROVENANCE,
      ownerType: 'Dirent',
      member,
      targets: [],
      evidence: 'Node 26.5.0 embedded internal/fs/utils JavaScript implementation',
      authority: nodeSourceAuthority({
        source: NODE_SOURCES.fileSystemUtilities,
        definitionMarker: `\n  ${member}(`,
        occurrenceCount: 1,
        bindingMarkers: [{
          text: '\n  Dirent,\n',
          occurrenceCount: 1,
        },],
        relatedSources: [{
          module: NODE_SOURCES.fileSystem
            .module,
          sourceDigest: NODE_SOURCES.fileSystem
            .sourceDigest,
          definitionMarkers: [
            {
              text: "} = require('internal/fs/utils');",
              occurrenceCount: 1,
            },
            {
              text: '  Dirent,\n  getDirent,',
              occurrenceCount: 1,
            },
            {
              text: '\n  Dirent,\n  Stats,',
              occurrenceCount: 1,
            },
          ],
        },],
      },),
    };
  },),
  ...[
    'isBlockDevice',
    'isCharacterDevice',
    'isDirectory',
    'isFIFO',
    'isFile',
    'isSocket',
    'isSymbolicLink',
  ].map(function statsObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: NODE_PROVENANCE,
      ownerType: 'StatsBase',
      member,
      targets: [],
      evidence: 'Node 26.5.0 embedded internal/fs/utils StatsBase implementation',
      authority: nodeSourceAuthority({
        source: NODE_SOURCES.fileSystemUtilities,
        definitionMarker: `\nStatsBase.prototype.${member} = function() {`,
        occurrenceCount: 1,
        bindingMarkers: [{
          text: "\n  Stats: deprecate(Stats, 'fs.Stats constructor is deprecated.', 'DEP0180'),",
          occurrenceCount: 1,
        },],
        relatedSources: [{
          module: NODE_SOURCES.fileSystem
            .module,
          sourceDigest: NODE_SOURCES.fileSystem
            .sourceDigest,
          definitionMarkers: [
            {
              text: "} = require('internal/fs/utils');",
              occurrenceCount: 1,
            },
            {
              text: '\n  Dirent,\n  Stats,',
              occurrenceCount: 1,
            },
          ],
        },],
      },),
    };
  },),
  {
    provenance: NODE_PROVENANCE,
    ownerType: 'node:url',
    member: 'fileURLToPath',
    targets: [],
    evidence: 'Node 26.5.0 embedded internal/url JavaScript implementation',
    authority: nodeSourceAuthority({
      source: NODE_SOURCES.url,
      definitionMarker: '\nfunction fileURLToPath(',
      occurrenceCount: 1,
      bindingMarkers: [{
        text: '\n  fileURLToPath,\n',
        occurrenceCount: 1,
      },],
      relatedSources: [{
        module: NODE_SOURCES.publicUrl
          .module,
        sourceDigest: NODE_SOURCES.publicUrl
          .sourceDigest,
        definitionMarkers: [
          {
            text: "} = require('internal/url');",
            occurrenceCount: 1,
          },
          {
            text: '  fileURLToPath,\n  fileURLToPathBuffer,',
            occurrenceCount: 2,
          },
          {
            text: '\n  // Utilities\n  pathToFileURL,\n  fileURLToPath,',
            occurrenceCount: 1,
          },
        ],
      },],
    },),
  },
];
