/**
 * Verified semantic type suggestions for readonly parameters.
 *
 * @module
 */

import type {
  Context,
  Fixer,
  Suggestion,
} from '@oxlint/plugins';
import type {
  ParameterDeclaration,
  SourceFile,
} from 'typescript/unstable/ast';
import {
  isArrayTypeNode,
  isImportDeclaration,
  isNamedImports,
  isStringLiteral,
} from 'typescript/unstable/ast/is';

import { classifyReadonlyType, } from './readonly-classifier.ts';

/**
 * Converts TypeScript offset to Oxlint offset after BOM stripping.
 *
 * @param offset - TypeScript source offset.
 *
 * @param hasBOM - Whether Oxlint stripped leading BOM.
 *
 * @returns Oxlint source offset.
 */
function oxlintOffset({
  offset,
  hasBOM,
}: {
  readonly offset: number;
  readonly hasBOM: boolean;
},): number {
  return hasBOM ? Math.max(
    0,
    offset - 1,
  ) : offset;
}

/**
 * Sentinel when source lacks named type-fest ReadonlyDeep import.
 */
const READONLY_DEEP_IMPORT_UNAVAILABLE: unique symbol = Symbol(
  'source lacks type-fest ReadonlyDeep import',
);

/* oxlint-disable typescript/prefer-readonly-parameter-types -- SourceFile mirrors TypeScript semantic AST identity. */
/**
 * Finds local name for named type-fest ReadonlyDeep import.
 *
 * @param sourceFile - Source file whose imports are inspected.
 *
 * @returns local import name or sentinel.
 */
function readonlyDeepLocalName(
  sourceFile: SourceFile,
): string | typeof READONLY_DEEP_IMPORT_UNAVAILABLE {
  /**
   * Named import specifier for ReadonlyDeep, when available.
   */
  const specifier = sourceFile.statements
    .filter(isImportDeclaration,)
    .filter(function typeFestImport(declaration,): boolean {
      return isStringLiteral(declaration.moduleSpecifier,)
        && (declaration.moduleSpecifier
          .text
          === 'type-fest');
    },)
    .flatMap(function namedBindings(declaration,) {
      /**
       * Named import bindings from type-fest declaration.
       */
      const bindings = declaration.importClause
        ?.namedBindings;
      return (bindings !== undefined) && isNamedImports(bindings,)
        ? [...bindings.elements,]
        : [];
    },)
    .find(function readonlyDeepSpecifier(element,): boolean {
      return (element.propertyName
        ?.text
        ?? element.name
        .text) === 'ReadonlyDeep';
    },);
  return specifier?.name
    .text
    ?? READONLY_DEEP_IMPORT_UNAVAILABLE;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ParameterDeclaration mirrors TypeScript semantic AST identity. */
/**
 * Builds verified deep-readonly array type suggestion.
 *
 * @param context - Rule context providing fix range mapping.
 *
 * @param parameter - TypeScript parameter with optional array type annotation.
 *
 * @param project - TypeScript project classifying array element type.
 *
 * @returns suggestion list, empty when exact rewrite is unavailable.
 *
 * @example
 * ```ts
 * readonlyArraySuggestions({ context, parameter, project });
 * ```
 */
function readonlyArraySuggestions({
  context,
  parameter,
  project,
}: {
  readonly context: Context;
  readonly parameter: ParameterDeclaration;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
},): Suggestion[] {
  if ((parameter.type === undefined) || (!isArrayTypeNode(parameter.type,)))
    return [];
  /**
   * Semantic element type used to prove deep readonly result.
   */
  const elementType = project.checker
    .getTypeFromTypeNode(parameter.type
      .elementType,);
  if (elementType === undefined)
    return [];
  /**
   * Element classification proving readonly prefix completes deep contract.
   */
  const elementClassification = classifyReadonlyType({
    checker: project.checker,
    project,
    type: elementType,
  },);
  if (elementClassification.kind !== 'honest-readonly')
    return [];
  /**
   * Source file owning parameter type.
   */
  const sourceFile = parameter.getSourceFile();
  /**
   * Oxlint replacement range spanning authored array type.
   */
  const range: [
    number,
    number
  ] = [
    oxlintOffset({
      offset: parameter.type
        .getStart(sourceFile,),
      hasBOM: context.sourceCode
        .hasBOM,
    },),
    oxlintOffset({
      offset: parameter.type
        .end,
      hasBOM: context.sourceCode
        .hasBOM,
    },),
  ];
  /**
   * Exact authored type with readonly array prefix.
   */
  const replacement = `readonly ${parameter.type
    .getText(sourceFile,)}`;
  return [
    {
      desc: `Replace ${parameter.type
        .getText(sourceFile,)} with ${replacement}.`,
      fix(fixer: Fixer,): ReturnType<Fixer['replaceTextRange']> {
        return fixer.replaceTextRange(
          range,
          replacement,
        );
      },
    },
  ];
}

/**
 * Builds type-fest ReadonlyDeep suggestion for mutable structural data.
 *
 * @param context - Rule context providing fix range mapping.
 *
 * @param parameter - TypeScript parameter with mutable type annotation.
 *
 * @param project - TypeScript project proving structural data classification.
 *
 * @returns suggestion list, empty when verified wrapper is unavailable.
 */
function readonlyDeepSuggestions({
  context,
  parameter,
  project,
}: {
  readonly context: Context;
  readonly parameter: ParameterDeclaration;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
},): Suggestion[] {
  if (parameter.type === undefined)
    return [];
  /**
   * Local imported name preserving authored import alias.
   */
  const localName = readonlyDeepLocalName(parameter.getSourceFile(),);
  if (localName === READONLY_DEEP_IMPORT_UNAVAILABLE)
    return [];
  /**
   * Semantic parameter type used to reject collection projection guesses.
   */
  const parameterType = project.checker
    .getTypeFromTypeNode(parameter.type,);
  if ((parameterType === undefined)
    || project.checker
    .isArrayType(parameterType,)
    || project.checker
    .isTupleType(parameterType,))
    return [];
  /**
   * Mutable structural classification with no opaque capability branch.
   */
  const classification = classifyReadonlyType({
    checker: project.checker,
    project,
    type: parameterType,
  },);
  if ((classification.kind !== 'mutable')
    || ((!classification.reason
      .startsWith('property ',))
      && (!classification.reason
        .startsWith('index signature',))))
    return [];
  /**
   * Source file owning authored type text.
   */
  const sourceFile = parameter.getSourceFile();
  /**
   * Authored type retained inside ReadonlyDeep projection.
   */
  const authoredType = parameter.type
    .getText(sourceFile,);
  /**
   * Exact projection using locally imported type-fest helper.
   */
  const replacement = `${localName}<${authoredType}>`;
  /**
   * Oxlint replacement range spanning authored parameter type.
   */
  const range: [
    number,
    number,
  ] = [
    oxlintOffset({
      offset: parameter.type
        .getStart(sourceFile,),
      hasBOM: context.sourceCode
        .hasBOM,
    },),
    oxlintOffset({
      offset: parameter.type
        .end,
      hasBOM: context.sourceCode
        .hasBOM,
    },),
  ];
  return [
    {
      desc: `Wrap ${authoredType} with ${localName}.`,
      fix(fixer: Fixer,): ReturnType<Fixer['replaceTextRange']> {
        return fixer.replaceTextRange(
          range,
          replacement,
        );
      },
    },
  ];
}

/**
 * Builds verified readonly type suggestions.
 *
 * @param context - Rule context providing fix range mapping.
 *
 * @param parameter - TypeScript parameter requiring readonly projection.
 *
 * @param project - TypeScript project proving suggested contract.
 *
 * @returns all verified suggestions for parameter type.
 *
 * @example
 * ```ts
 * readonlyParameterSuggestions({ context, parameter, project });
 * ```
 */
export function readonlyParameterSuggestions({
  context,
  parameter,
  project,
}: {
  readonly context: Context;
  readonly parameter: ParameterDeclaration;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
},): Suggestion[] {
  return [
    ...readonlyArraySuggestions({
      context,
      parameter,
      project,
    },),
    ...readonlyDeepSuggestions({
      context,
      parameter,
      project,
    },),
  ];
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
