/**
 * Audited Lezer syntax-tree observation effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Source-audited Lezer node navigation effects.
 */
export const LEZER_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  'getChild',
  'getChildren',
].map(function syntaxNodeNavigation(member,): IntrinsicEffectEntry {
  return {
    provenance: {
      kind: 'package',
      packageName: '@lezer/common',
      major: 1,
    },
    ownerType: 'SyntaxNode',
    member,
    targets: [],
    receiverValuesReachResult: true,
    evidence: '@lezer/common 1.5.2 commit de5f96276a2954c249de1475e8b03f79c20d9ce4 src/tree.ts sha256 640581681d557a446609e2c8e40fd19d2ce3f0ff9ccb99ca743db1a344934d77 shipped dist/index.js sha256 dab441db7948aae93b8a210d30a0481125bcb8943b129a8c5ebec1354a029e8d',
  };
},);
