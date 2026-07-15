/**
 * Audited Optique parser effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Exact Optique package provenance.
 */
const OPTIQUE_PROVENANCE = {
  kind: 'package',
  packageName: '@optique/core',
  major: 1,
} as const;

/**
 * Pinned Optique parser implementation identity.
 */
const PARSER_EVIDENCE = '@optique/core 1.1.1 commit b8d39082fdeb37bb16c68b2dc2396d4c9c45b1d5 package/core/src/internal/parser.ts sha256 b8ad8e789978a25980f9f46b442e7117f36feaede399fe74e0f1a59411787376 shipped dist/internal/parser.js sha256 138e40f7f4c2bb88c3e44bdf5ed23caf61c553540b60a3aae23d201888ca8671';

/**
 * Pinned Optique facade implementation identity.
 */
const FACADE_EVIDENCE = '@optique/core 1.1.1 commit b8d39082fdeb37bb16c68b2dc2396d4c9c45b1d5 package/core/src/facade.ts sha256 cf01245fd9322d8a4eca0a718f4e126acf0671d2c79eeadb3c29d3ef2dda5d65 shipped dist/facade.js sha256 b964c1f6b330b37e855f965a89a9b64e2a4dd5e41b4d93e674cfe540cbba20cc';

/**
 * Parser object methods invoked by both entry points.
 */
const PARSER_METHOD_INVOCATION = [{
  argumentIndex: 0,
  propertyNames: [
    'complete',
    'parse',
  ],
},] as const;

/**
 * Source-audited Optique effects accepted by semantic analysis.
 */
export const OPTIQUE_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: OPTIQUE_PROVENANCE,
    ownerType: 'globalThis',
    member: 'parseSync',
    targets: [],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 0,
      },
      {
        kind: 'argument',
        index: 2,
      },
    ],
    invokedArgumentProperties: PARSER_METHOD_INVOCATION,
    evidence: `${PARSER_EVIDENCE}; parser methods receive a readonly argument buffer, while parser and options capabilities remain opaque`,
  },
  {
    provenance: OPTIQUE_PROVENANCE,
    ownerType: 'globalThis',
    member: 'runParserSync',
    targets: [],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 0,
      },
      {
        kind: 'argument',
        index: 3,
      },
    ],
    invokedArgumentProperties: [
      ...PARSER_METHOD_INVOCATION,
      {
        argumentIndex: 3,
        propertyNames: [
          'onError',
          'stderr',
          'stdout',
        ],
      },
    ],
    evidence: `${FACADE_EVIDENCE}; facade parses a readonly argument buffer while invoking parser and configured output or error capabilities`,
  },
];
