/**
 * Audited Turso database package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Turso database implementation audit identity.
 */
const TURSO_DATABASE_EVIDENCE = '@tursodatabase/database-common 0.6.1 commit 76af5a1250cd98bb26c13862093a638714b0a3a6 bindings/javascript/packages/common/promise.ts sha256 e3f721edd511079ad107707a0636481d9444668e454e44b969abcfd9d46f5715';

/**
 * Audited effects for Turso database calls.
 */
export const TURSO_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: {
      kind: 'package',
      packageName: '@tursodatabase/database-common',
      major: 0,
    },
    ownerType: 'Database',
    member: 'exec',
    targets: [{ kind: 'receiver', },],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 0,
      },
      {
        kind: 'argument',
        index: 1,
      },
    ],
    evidence: `${TURSO_DATABASE_EVIDENCE}; exec acquires receiver lock, creates native executor from SQL and options, advances database I/O, resets executor, and releases lock`,
  },
];
