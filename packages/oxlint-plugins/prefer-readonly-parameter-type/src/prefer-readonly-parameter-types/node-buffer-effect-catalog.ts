/**
 * Audited Node buffer host effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import {
  NODE_PROVENANCE,
  NODE_SOURCES,
  nodeSourceAuthority,
} from './node-effect-authority.ts';

/**
 * Buffer effects accepted only for exact declaration and source identities.
 */
export const NODE_BUFFER_EFFECTS: readonly IntrinsicEffectEntry[] = [
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
    ownerType: 'Buffer',
    member: 'copy',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'Node 26.5.0 Buffer.copy copies receiver bytes into target argument',
    authority: nodeSourceAuthority({
      source: NODE_SOURCES.buffer,
      definitionMarker: '\nBuffer.prototype.copy =\n  function copy(target, targetStart, sourceStart, sourceEnd) {',
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
    ownerType: 'Buffer',
    member: 'toString',
    targets: [],
    evidence: 'Node 26.5.0 Buffer.toString observes receiver bytes',
    authority: nodeSourceAuthority({
      source: NODE_SOURCES.buffer,
      definitionMarker: '\nBuffer.prototype.toString = function toString(encoding, start, end) {',
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
  ...[
    {
      member: 'readInt32LE',
      definitionMarker: '\nfunction readInt32LE(buf, offset = 0) {',
      bindingMarker: '  proto.readInt32LE = function(offset) { return readInt32LE(this, offset); };',
    },
    {
      member: 'readUInt16LE',
      definitionMarker: '\nfunction readUInt16LE(buf, offset = 0) {',
      bindingMarker: '  proto.readUInt16LE = function(offset) { return readUInt16LE(this, offset); };',
    },
  ].map(function bufferIntegerRead({
    member,
    definitionMarker,
    bindingMarker,
  }: Readonly<{
    member: string;
    definitionMarker: string;
    bindingMarker: string;
  }>,): IntrinsicEffectEntry {
    return {
      provenance: NODE_PROVENANCE,
      ownerType: 'Buffer',
      member,
      targets: [],
      evidence: `Node 26.5.0 ${member} observes receiver bytes`,
      authority: nodeSourceAuthority({
        source: NODE_SOURCES.internalBuffer,
        definitionMarker,
        occurrenceCount: 1,
        bindingMarkers: [{
          text: bindingMarker,
          occurrenceCount: 1,
        },],
        relatedSources: [{
          module: NODE_SOURCES.buffer
            .module,
          sourceDigest: NODE_SOURCES.buffer
            .sourceDigest,
          definitionMarkers: [
            {
              text: "} = require('internal/buffer');",
              occurrenceCount: 1,
            },
            {
              text: '\naddBufferPrototypeMethods(Buffer.prototype);',
              occurrenceCount: 1,
            },
            {
              text: '\n  Buffer,\n',
              occurrenceCount: 1,
            },
          ],
        },],
      },),
    };
  },),
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
];
