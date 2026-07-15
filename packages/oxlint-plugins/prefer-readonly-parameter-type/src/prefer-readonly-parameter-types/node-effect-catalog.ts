/**
 * Audited Node host intrinsic effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import { NODE_BUFFER_EFFECTS, } from './node-buffer-effect-catalog.ts';
import { NODE_CHILD_PROCESS_EFFECTS, } from './node-child-process-effect-catalog.ts';
import {
  NODE_PROVENANCE,
  NODE_SOURCES,
  nodeSourceAuthority,
} from './node-effect-authority.ts';

/**
 * Node effects accepted only for exact declaration,
 * embedded-source,
 * and callable-definition identities.
 */
export const NODE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...NODE_BUFFER_EFFECTS,
  ...NODE_CHILD_PROCESS_EFFECTS,
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
