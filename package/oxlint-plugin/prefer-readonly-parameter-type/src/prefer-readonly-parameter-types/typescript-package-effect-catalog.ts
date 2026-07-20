/**
 * Audited TypeScript compiler-API package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import { receiverEffect, } from './package-receiver-effect.ts';

/**
 * Audited effects for TypeScript 7 sync-API calls.
 */
export const TYPESCRIPT_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'isArrayLiteralExpression',
    'isArrayTypeNode',
    'isBinaryExpression',
    'isBindingElement',
    'isCallExpression',
    'isCallSignatureDeclaration',
    'isClassLikeDeclaration',
    'isConstructSignatureDeclaration',
    'isConstructorTypeNode',
    'isDeleteExpression',
    'isElementAccessExpression',
    'isExportDeclaration',
    'isFunctionLikeDeclaration',
    'isFunctionTypeNode',
    'isForOfStatement',
    'isGetAccessorDeclaration',
    'isIdentifier',
    'isImportClause',
    'isImportDeclaration',
    'isImportEqualsDeclaration',
    'isImportSpecifier',
    'isMethodDeclaration',
    'isMethodSignatureDeclaration',
    'isNamedExports',
    'isNamedImports',
    'isNamespaceImport',
    'isObjectLiteralExpression',
    'isPropertyAssignment',
    'isPropertyDeclaration',
    'isPostfixUnaryExpression',
    'isPrefixUnaryExpression',
    'isPropertyAccessExpression',
    'isReturnStatement',
    'isSetAccessorDeclaration',
    'isShorthandPropertyAssignment',
    'isSpreadAssignment',
    'isSpreadElement',
    'isSourceFile',
    'isStringLiteral',
    'isTypeReferenceNode',
    'isVariableDeclaration',
    'isVariableDeclarationList',
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
      auditTier: 'api-contract',
      evidence: 'typescript dist/ast predicate declarations',
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
      auditTier: 'api-contract',
      evidence: 'typescript dist/api/sync/api.d.ts Checker query declaration',
    };
  },),
  ...[
    'getAliasSymbol',
    'getAliasTypeArguments',
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
      auditTier: 'api-contract',
      evidence: 'typescript dist/api/sync/types.d.ts Type query declaration',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: 'typescript',
      major: 7,
    },
    /* Audited 2026-07-16 with ownerType Type; the 2026-07-19 dependency
     * update installed declarations moving getTarget onto the
     * TypeReference interface, so owner matching now sees TypeReference. */
    ownerType: 'TypeReference',
    member: 'getTarget',
    targets: [],
    auditTier: 'api-contract',
    evidence: 'typescript dist/api/sync/types.d.ts TypeReference target query; dist/api/sync/api.js TypeObject.getTarget reads target through ObjectRegistry.fetchType; only library-internal identity cache changes',
  },
  {
    provenance: {
      kind: 'package',
      packageName: 'typescript',
      major: 7,
    },
    ownerType: 'UnionOrIntersectionType',
    member: 'getTypes',
    targets: [],
    auditTier: 'api-contract',
    evidence: 'typescript dist/api/sync/types.d.ts union constituent query',
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
      auditTier: 'api-contract',
      evidence: 'typescript dist/ast/index.d.ts Node source query',
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
    auditTier: 'api-contract',
    evidence: 'typescript dist/api/sync/api.d.ts NodeHandle resolution',
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
      auditTier: 'api-contract',
      evidence: 'typescript dist/api/sync/api.d.ts Program source query',
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
      auditTier: 'api-contract',
      evidence: 'typescript dist/api/sync/api.d.ts API declaration',
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
    auditTier: 'api-contract',
    evidence: 'typescript dist/api/sync/api.d.ts Snapshot declaration',
  },),
];
