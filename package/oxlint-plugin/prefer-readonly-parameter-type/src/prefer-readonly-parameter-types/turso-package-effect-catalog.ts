/**
 * Audited Turso database package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Turso database implementation audit identity.
 *
 * Re-audited 2026-07-20 for 0.7.0: `exec` still acquires the receiver
 * lock, builds a native executor from SQL and options, steps with I/O
 * advancement, resets the executor, and releases the lock; the version
 * adds an unrelated `batch()` API and widens lock visibility to
 * protected.
 */
const TURSO_DATABASE_EVIDENCE = '@tursodatabase/database-common 0.7.0 commit e7cb62a8bd2f3655a661a621ee389365c1a1e43e bindings/javascript/packages/common/promise.ts sha256 07ac3b75ac37eb0d350fe8ea4965b8470178ad7f2f849466b9d932f047c2a621 shipped dist/promise.js sha256 eb688cc7a808ace08c6c9d5346938ce81e881350780013a22ce522a819b00db1';

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
    auditTier: 'shipped-content',
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
