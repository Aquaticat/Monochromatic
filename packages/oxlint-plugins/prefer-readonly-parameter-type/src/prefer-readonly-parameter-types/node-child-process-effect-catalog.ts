/**
 * Audited Node child-process host effects.
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
 * Child-process effects accepted only for exact declaration and source identities.
 */
export const NODE_CHILD_PROCESS_EFFECTS: readonly IntrinsicEffectEntry[] = [{
  provenance: NODE_PROVENANCE,
  ownerType: 'node:child_process',
  member: 'spawn',
  targets: [],
  opaqueTargets: [
    {
      kind: 'argument',
      index: 1,
      callArgumentCount: 2,
      freshContainerShieldsContents: true,
    },
    {
      kind: 'argument',
      index: 1,
      callArgumentCount: 2,
      propertyNames: [
        'cwd',
        'env',
        'signal',
        'stdio',
      ],
    },
    {
      kind: 'argument',
      index: 2,
      callArgumentCount: 3,
      freshContainerShieldsContents: true,
    },
    {
      kind: 'argument',
      index: 2,
      callArgumentCount: 3,
      propertyNames: [
        'cwd',
        'env',
        'signal',
        'stdio',
      ],
    },
  ],
  evidence: 'Node 26.5.0 child_process.spawn copies the command arguments while options can expose hooks, environment, signals, and stdio capabilities',
  authority: nodeSourceAuthority({
    source: NODE_SOURCES.childProcess,
    definitionMarker: '\nfunction spawn(file, args, options) {',
    occurrenceCount: 1,
    bindingMarkers: [
      {
        text: '\nmodule.exports = {',
        occurrenceCount: 1,
      },
      {
        text: '\n  spawn,\n',
        occurrenceCount: 1,
      },
    ],
    relatedSources: [],
  },),
},];
