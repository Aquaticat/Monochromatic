/**
 * Exact package-owned intrinsic effects.
 *
 * @module
 */

import type {
  IntrinsicEffectEntry,
  IntrinsicProvenance,
} from './intrinsic-effect-catalog.ts';
import { PI_PACKAGE_EFFECTS, } from './pi-package-effect-catalog.ts';

/**
 * Shared receiver mutation target.
 */
const RECEIVER = { kind: 'receiver', } as const;

/**
 * Creates package receiver mutation entry.
 *
 * @param provenance - Exact package and major identity.
 *
 * @param ownerType - Declaring receiver type.
 *
 * @param member - Mutating member name.
 *
 * @param evidence - Audited declaration evidence.
 *
 * @returns package receiver effect.
 */
function receiverEffect({
  provenance,
  ownerType,
  member,
  evidence,
}: {
  readonly provenance: IntrinsicProvenance;
  readonly ownerType: string;
  readonly member: string;
  readonly evidence: string;
},): IntrinsicEffectEntry {
  return {
    provenance,
    ownerType,
    member,
    targets: [RECEIVER,],
    evidence,
  };
}

/**
 * Package effects audited by exact current-lock major.
 */
export const PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...PI_PACKAGE_EFFECTS,
  receiverEffect({
    provenance: {
      kind: 'package',
      packageName: '@oxlint/plugins',
      major: 1,
    },
    ownerType: 'Context',
    member: 'report',
    evidence: '@oxlint/plugins 1.73 Context report diagnostic emission',
  },),
  ...[
    'getAllComments',
    'getCommentsBefore',
    'getCommentsInside',
    'getDeclaredVariables',
    'getFirstToken',
    'getIndexFromLoc',
    'getLastToken',
    'getLocFromIndex',
    'getScope',
    'getText',
    'getTokenAfter',
    'getTokenBefore',
    'getTokensBetween',
    'insertTextAfter',
    'insertTextAfterRange',
    'insertTextBefore',
    'insertTextBeforeRange',
    'replaceText',
    'replaceTextRange',
  ].map(function oxlintObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@oxlint/plugins',
        major: 1,
      },
      ownerType: '__type',
      member,
      targets: [],
      evidence: '@oxlint/plugins 1.73 index.d.ts source and fixer descriptor operations',
    };
  },),
  ...[
    'isRecord',
    'parseMutationContractBlocks',
  ].map(function sharedPluginObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@monochromatic-dev/config-oxlint-shared',
        major: 0,
      },
      ownerType: 'globalThis',
      member,
      targets: [],
      evidence: 'config-oxlint-shared 0.0.1 source pure parser and record predicates',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/module-or-throw',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'nonNullishOrThrow',
    targets: [],
    evidence: 'module-or-throw 0.0.1 nonNullishOrThrow validation without argument mutation',
  },
  ...[
    'isArrayLiteralExpression',
    'isArrayTypeNode',
    'isBinaryExpression',
    'isBindingElement',
    'isCallExpression',
    'isCallSignatureDeclaration',
    'isConstructSignatureDeclaration',
    'isConstructorTypeNode',
    'isDeleteExpression',
    'isFunctionLikeDeclaration',
    'isFunctionTypeNode',
    'isIdentifier',
    'isImportDeclaration',
    'isMethodSignatureDeclaration',
    'isNamedImports',
    'isObjectLiteralExpression',
    'isPropertyAssignment',
    'isPostfixUnaryExpression',
    'isPrefixUnaryExpression',
    'isPropertyAccessExpression',
    'isReturnStatement',
    'isShorthandPropertyAssignment',
    'isSpreadAssignment',
    'isSpreadElement',
    'isStringLiteral',
    'isTypeReferenceNode',
    'isVariableDeclaration',
  ].map(function typescriptAstObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: 'typescript',
        major: 7,
      },
      ownerType: 'globalThis',
      member,
      targets: [],
      evidence: 'typescript 7.0.2 dist/ast predicate declarations',
    };
  },),
  ...[
    'getAliasedSymbol',
    'getBaseConstraintOfType',
    'getIndexInfosOfType',
    'getPropertiesOfType',
    'getResolvedSignature',
    'getResolvedSymbol',
    'getSignaturesOfType',
    'getShorthandAssignmentValueSymbol',
    'getSymbolAtLocation',
    'getTypeArguments',
    'getTypeAtLocation',
    'getTypeFromTypeNode',
    'getTypeOfSymbolAtLocation',
    'isArrayType',
    'isTupleType',
  ].map(function typescriptCheckerObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: 'typescript',
        major: 7,
      },
      ownerType: 'Checker',
      member,
      targets: [],
      evidence: 'typescript 7.0.2 dist/api/sync/api.d.ts Checker query declaration',
    };
  },),
  ...[
    'getAliasSymbol',
    'getSymbol',
    'isIntersectionType',
    'isObjectType',
    'isTupleType',
    'isTypeParameter',
    'isTypeReference',
    'isUnionType',
  ].map(function typescriptTypeObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: 'typescript',
        major: 7,
      },
      ownerType: 'Type',
      member,
      targets: [],
      evidence: 'typescript 7.0.2 dist/api/sync/types.d.ts Type query declaration',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: 'typescript',
      major: 7,
    },
    ownerType: 'UnionOrIntersectionType',
    member: 'getTypes',
    targets: [],
    evidence: 'typescript 7.0.2 dist/api/sync/types.d.ts union constituent query',
  },
  ...[
    'getSourceFile',
    'getStart',
    'getText',
  ].map(function typescriptNodeObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: 'typescript',
        major: 7,
      },
      ownerType: 'Node',
      member,
      targets: [],
      evidence: 'typescript 7.0.2 dist/ast/index.d.ts Node source query',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: 'typescript',
      major: 7,
    },
    ownerType: 'NodeHandle',
    member: 'resolve',
    targets: [],
    evidence: 'typescript 7.0.2 dist/api/sync/api.d.ts NodeHandle resolution',
  },
  ...[
    'getSourceFile',
    'getSourceFileNames',
    'isSourceFileDefaultLibrary',
    'isSourceFileFromExternalLibrary',
  ].map(function typescriptProgramObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: 'typescript',
        major: 7,
      },
      ownerType: 'Program',
      member,
      targets: [],
      evidence: 'typescript 7.0.2 dist/api/sync/api.d.ts Program source query',
    };
  },),
  ...[
    'clearSourceFileCache',
    'close',
    'updateSnapshot',
  ].map(function typescriptApiEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: {
        kind: 'package',
        packageName: 'typescript',
        major: 7,
      },
      ownerType: 'API',
      member,
      evidence: 'typescript 7.0.2 dist/api/sync/api.d.ts API declaration',
    },);
  },),
  receiverEffect({
    provenance: {
      kind: 'package',
      packageName: 'typescript',
      major: 7,
    },
    ownerType: 'Snapshot',
    member: 'dispose',
    evidence: 'typescript 7.0.2 dist/api/sync/api.d.ts Snapshot declaration',
  },),
];
