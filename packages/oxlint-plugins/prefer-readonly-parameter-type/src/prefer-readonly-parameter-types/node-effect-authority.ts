/**
 * Shared source authority for audited Node host effects.
 *
 * @module
 */

import type {
  NodeSourceEffectAuthority,
  NodeSourceEvidence,
} from './host-effect-authority.ts';
import type { IntrinsicProvenance, } from './intrinsic-effect-catalog.ts';

/**
 * Exact Node 26.5.0 embedded JavaScript source identities.
 */
export const NODE_SOURCES = {
  buffer: {
    nodeVersion: '26.5.0',
    module: 'buffer',
    sourceDigest: '1b15446290915577350455b136d69041b6b9900f72946ec3ef8340240c9e706b',
  },
  childProcess: {
    nodeVersion: '26.5.0',
    module: 'child_process',
    sourceDigest: 'fc85eea664a8db6e5492850961f9b2b84d553dde0217978ec60f304a0cd23585',
  },
  internalBuffer: {
    nodeVersion: '26.5.0',
    module: 'internal/buffer',
    sourceDigest: 'ce1f2b80ecaf7f4d8ef3ff5d40e77e48c4413760e1a743c8c1b24cabfc1c25d8',
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
export const NODE_PROVENANCE: IntrinsicProvenance = {
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
export function nodeSourceAuthority({
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
