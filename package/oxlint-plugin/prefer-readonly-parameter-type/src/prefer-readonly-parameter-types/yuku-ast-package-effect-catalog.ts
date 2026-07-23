/**
 * Audited yuku-ast package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import { receiverEffect, } from './package-receiver-effect.ts';

/**
 * yuku-ast implementation audit identity.
 *
 * Audited 2026-07-22 for 0.7.3: concrete node guards under `is` are
 * built uniformly by `Object.fromEntries(NODE_TYPES.map(...))` as
 * `(node) => node != null && node.type === type`, and alias guards
 * (`TSType` among them) test `node.type` membership in a frozen alias
 * set; both read the argument's `type` property and change nothing.
 * `WalkContext.skip` assigns the context's private `_skip` flag and
 * touches no other state.
 */
const YUKU_AST_EVIDENCE = 'yuku-ast 0.7.3 shipped dist/index.js sha256 20fb1bc10f74e55520410e7f0fc14c2fdac8a777327ec55f3993ef621aea5cd2';

/**
 * Node-kind guard members of `is` that repository code calls; every
 * guard shares the audited pure `node.type` comparison shape.
 */
const YUKU_AST_GUARD_MEMBERS: readonly string[] = [
  'TSDeclareFunction',
  'TSInterfaceDeclaration',
  'TSType',
  'TSTypeAliasDeclaration',
  'TSTypeAnnotation',
  'TSTypeParameterDeclaration',
  'TSTypeParameterInstantiation',
];

/**
 * Audited effects for yuku-ast node guards and walk control.
 */
export const YUKU_AST_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...YUKU_AST_GUARD_MEMBERS.map(function guardObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: 'yuku-ast',
        major: 0,
      },
      ownerType: '__type',
      member,
      targets: [],
      auditTier: 'shipped-content',
      evidence: `${YUKU_AST_EVIDENCE}; the guard reads the argument's type tag and returns a boolean; it mutates nothing and invokes no argument values, and yuku parse output decodes to plain data objects, matching the empty-effect precedent of the @oxlint/plugins observation entries`,
    };
  },),
  receiverEffect({
    provenance: {
      kind: 'package',
      packageName: 'yuku-ast',
      major: 0,
    },
    ownerType: 'WalkContext',
    member: 'skip',
    auditTier: 'shipped-content',
    evidence: `${YUKU_AST_EVIDENCE}; skip assigns the walk context's private _skip flag so the walker bypasses the current node's children, and changes nothing else`,
  },),
];
