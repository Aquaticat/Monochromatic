import {
  type DocComment,
  type DocParamBlock,
  type ParserContext,
  type ParserMessage,
  TSDocConfiguration,
  TSDocParser,
} from '@microsoft/tsdoc';

import type {
  Comment,
  Context,
  Span,
} from '@oxlint/plugins';

/** File extensions excluded from TSDoc rules. */
export const IGNORED_EXTENSIONS: readonly string[] = [
  '.test.ts',
  '.spec.ts',
  '.bench.ts',
  '.js',
  '.d.ts',
  '.mjs',
  '.cjs',
  '.d.mts',
  '.d.cts',
];

/** Shared TSDoc parser configuration with all standard tags. */
const tsdocConfiguration: TSDocConfiguration = new TSDocConfiguration();

/** Shared TSDoc parser instance reused across all rule invocations. */
const tsdocParser: TSDocParser = new TSDocParser(tsdocConfiguration);

/**
 * Result of extracting and parsing a TSDoc comment for a node.
 *
 * @example
 * ```ts
 * const result = parseTsdocForNode(node, context);
 * if (result !== undefined) {
 *   console.log(result.docComment.summarySection);
 * }
 * ```
 */
export type TsdocParseResult = {
  /** Raw block comment AST node from oxlint. */
  readonly comment: Comment;
  /** Parsed TSDoc context containing docComment, messages, and tokens. */
  readonly parserContext: ParserContext;
  /** Convenience alias for parserContext.docComment. */
  readonly docComment: DocComment;
  /** Convenience alias for parserContext.log.messages. */
  readonly messages: readonly ParserMessage[];
};

/**
 * Checks whether given file should be skipped by TSDoc rules.
 *
 * @param filename - absolute path of file being linted
 * @returns true when file has an ignored extension
 *
 * @example
 * ```ts
 * if (shouldIgnoreFile(context.filename)) return false;
 * ```
 */
export function shouldIgnoreFile(filename: string): boolean {
  return IGNORED_EXTENSIONS.some(function endsWithIgnored(ext): boolean {
    return filename.endsWith(ext);
  });
}

/**
 * Checks whether a block comment is a TSDoc comment (starts with `*`).
 *
 * @param comment - AST comment node
 * @returns true for `/** ... *\/` style comments
 */
function isTsdocBlock(comment: Comment): boolean {
  return comment.type === 'Block' && comment.value.startsWith('*');
}

/**
 * Node types where `getCommentsBefore` may fail to find TSDoc because
 * the comment is attached to a parent scope (export declaration).
 *
 * FunctionExpression and ArrowFunctionExpression are intentionally
 * excluded because their comments belong to the enclosing
 * VariableDeclaration or MethodDefinition which owns the TSDoc.
 */
const FALLBACK_ELIGIBLE_TYPES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'VariableDeclaration',
  'ClassDeclaration',
  'MethodDefinition',
  'TSAbstractMethodDefinition',
  'PropertyDefinition',
  'TSEnumDeclaration',
  'TSEnumMember',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
]);

/**
 * Finds the TSDoc block comment associated with a node.
 *
 * Uses `getCommentsBefore` first (cheapest lookup), then falls back to
 * scanning `getAllComments()` for the closest preceding TSDoc comment
 * whose end position is on the line immediately before the node start.
 * This fallback handles `export` declarations where `getCommentsBefore`
 * returns nothing because the comment is attached to a parent
 * ExportNamedDeclaration scope boundary.
 *
 * The fallback only applies to declaration-level node types, not to
 * FunctionExpression or ArrowFunctionExpression, because their TSDoc
 * is owned by the enclosing VariableDeclaration or MethodDefinition.
 *
 * @param node - AST node to find TSDoc for
 * @param context - oxlint rule context providing sourceCode
 * @returns block comment starting with `*`, or undefined when absent
 *
 * @example
 * ```ts
 * const comment = findTsdocComment(node, context);
 * ```
 */
export function findTsdocComment(node: Span, context: Context): Comment | undefined {
  // Fast path: getCommentsBefore works for most declarations
  const comments = context.sourceCode.getCommentsBefore(node);
  const found = comments.findLast(isTsdocBlock);
  if (found !== undefined) {
    return found;
  }

  // Only fall back for declaration-level nodes, not expressions inside them
  const nodeType = (node as unknown as Record<string, unknown>).type as string | undefined;
  if (nodeType === undefined || !FALLBACK_ELIGIBLE_TYPES.has(nodeType)) {
    return undefined;
  }

  // Fallback: scan all comments for the closest TSDoc ending on the line
  // immediately before this node. Handles exported declarations where
  // getCommentsBefore returns nothing because the comment is before the
  // `export` keyword rather than the inner declaration.
  const nodeStartLine = node.loc.start.line;
  const allComments = context.sourceCode.getAllComments();

  let best: Comment | undefined;
  for (const comment of allComments) {
    if (!isTsdocBlock(comment)) {
      continue;
    }
    const commentEndLine = comment.loc.end.line;
    if (commentEndLine >= nodeStartLine) {
      continue;
    }
    if (nodeStartLine - commentEndLine > 1) {
      continue;
    }
    if (best === undefined || comment.loc.end.line > best.loc.end.line) {
      best = comment;
    }
  }

  return best;
}

/**
 * Extracts and parses the TSDoc comment for a given AST node.
 *
 * @param node - AST node to find TSDoc for
 * @param context - oxlint rule context
 * @returns parsed result, or undefined when no TSDoc comment precedes the node
 *
 * @example
 * ```ts
 * const result = parseTsdocForNode(node, context);
 * if (result === undefined) return;
 * for (const message of result.messages) {
 *   context.report({ node, message: message.toString() });
 * }
 * ```
 */
export function parseTsdocForNode(
  node: Span,
  context: Context,
): TsdocParseResult | undefined {
  const comment = findTsdocComment(node, context);
  if (comment === undefined) {
    return undefined;
  }

  // Reconstruct full comment text as the parser expects `/** ... */`
  const commentText = `/*${comment.value}*/`;
  const parserContext = tsdocParser.parseString(commentText);

  return {
    comment,
    parserContext,
    docComment: parserContext.docComment,
    messages: parserContext.log.messages,
  };
}

/**
 * Unwraps a MethodDefinition or TSAbstractMethodDefinition to its inner
 * function value, or returns the node itself for other function-like types.
 *
 * @param node - AST node representing a function-like declaration
 * @returns inner function node, or undefined when node has no `.value`
 */
function unwrapMethodDefinition(node: Record<string, unknown>): Record<string, unknown> | undefined {
  if (node.type === 'MethodDefinition' || node.type === 'TSAbstractMethodDefinition') {
    return node.value as Record<string, unknown> | undefined;
  }
  return node;
}

/**
 * Extracts the raw `params` array from a function-like AST node.
 *
 * Handles unwrapping MethodDefinition to its inner function value.
 *
 * @param node - AST node representing a function-like declaration
 * @returns raw parameter AST nodes, or empty array when absent
 */
function extractRawParams(node: Record<string, unknown>): readonly Record<string, unknown>[] {
  const target = unwrapMethodDefinition(node);
  if (target === undefined) {
    return [];
  }
  return target.params as Array<Record<string, unknown>> | undefined ?? [];
}

/**
 * Extracts parameter names from a function-like AST node.
 *
 * Handles FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
 * MethodDefinition, and TSMethodSignature nodes.
 *
 * @param node - AST node representing a function-like declaration
 * @returns array of parameter name strings, excluding rest-element `...` prefix
 *
 * @example
 * ```ts
 * const names = extractParamNames(functionNode);
 * // ['first', 'second', 'options']
 * ```
 */
export function extractParamNames(node: Span & Record<string, unknown>): readonly string[] {
  return extractRawParams(node).flatMap(function extractName(param): readonly string[] {
    return extractBindingName(param as Record<string, unknown>);
  });
}

/**
 * Recursively extracts binding names from a parameter pattern.
 *
 * @param pattern - AST binding pattern node
 * @returns array of extracted name strings
 */
function extractBindingName(pattern: Record<string, unknown>): readonly string[] {
  switch (pattern.type) {
    case 'Identifier': {
      const name = pattern.name as string;
      // Skip `this` parameter in TypeScript
      return name === 'this' ? [] : [name];
    }
    case 'AssignmentPattern': {
      return extractBindingName(pattern.left as Record<string, unknown>);
    }
    case 'RestElement': {
      return extractBindingName(pattern.argument as Record<string, unknown>);
    }
    case 'TSParameterProperty': {
      return extractBindingName(pattern.parameter as Record<string, unknown>);
    }
    case 'ObjectPattern':
    case 'ArrayPattern': {
      // Destructured params don't map to individual @param names
      return [];
    }
    default: {
      return [];
    }
  }
}

/**
 * Collects property names from destructured parameters (ObjectPattern/ArrayPattern).
 *
 * For `function foo({ a, b }: Options)`, returns `['a', 'b']`.
 * For `function foo(x: number, { a }: Options)`, returns `['a']`.
 * Named parameters (Identifier) are excluded since `extractParamNames`
 * already handles those.
 *
 * Supports nested unwrapping through AssignmentPattern (default values),
 * RestElement (rest patterns), and TSParameterProperty (constructor params).
 *
 * @param node - AST node representing a function-like declaration
 * @returns set of property name strings from all destructured parameters
 *
 * @example
 * ```ts
 * // function foo({ value, strs }: Options): void
 * const destructured = extractDestructuredParamNames(node);
 * // Set { 'value', 'strs' }
 * ```
 */
export function extractDestructuredParamNames(node: Span & Record<string, unknown>): ReadonlySet<string> {
  const names = new Set<string>();

  for (const param of extractRawParams(node)) {
    collectDestructuredNames(param as Record<string, unknown>, names);
  }

  return names;
}

/**
 * Recursively collects property names from a destructured parameter pattern
 * into the provided set.
 *
 * @param pattern - AST binding pattern node
 * @param names - mutable set to collect names into
 */
function collectDestructuredNames(pattern: Record<string, unknown>, names: Set<string>): void {
  switch (pattern.type) {
    case 'Identifier': {
      // Named params are handled by extractParamNames, skip here
      return;
    }
    case 'AssignmentPattern': {
      // `{ a = defaultValue }` -- unwrap to the left side
      collectDestructuredNames(pattern.left as Record<string, unknown>, names);
      return;
    }
    case 'RestElement': {
      // `...rest` inside destructuring
      collectDestructuredNames(pattern.argument as Record<string, unknown>, names);
      return;
    }
    case 'TSParameterProperty': {
      collectDestructuredNames(pattern.parameter as Record<string, unknown>, names);
      return;
    }
    case 'ObjectPattern': {
      const properties = pattern.properties as Array<Record<string, unknown>> | undefined;
      if (properties === undefined) {
        return;
      }
      for (const prop of properties) {
        if (prop.type === 'RestElement') {
          // `{ ...rest }` inside object destructuring
          collectDestructuredNames(prop, names);
        } else {
          // Property node -- extract the key name
          const key = prop.key as Record<string, unknown> | undefined;
          if (key !== undefined && key.type === 'Identifier') {
            names.add(key.name as string);
          }
        }
      }
      return;
    }
    case 'ArrayPattern': {
      // Array destructuring: `[a, b]` -- elements are binding patterns
      const elements = pattern.elements as Array<Record<string, unknown> | null> | undefined;
      if (elements === undefined) {
        return;
      }
      for (const element of elements) {
        if (element !== null) {
          collectDestructuredNames(element, names);
        }
      }
      return;
    }
    default: {
      return;
    }
  }
}

/**
 * Extracts documented @param names from a parsed TSDoc comment.
 *
 * @param docComment - parsed TSDoc DocComment
 * @returns array of parameter names found in @param tags
 *
 * @example
 * ```ts
 * const docParamNames = extractDocParamNames(result.docComment);
 * ```
 */
export function extractDocParamNames(docComment: DocComment): readonly string[] {
  return docComment.params.blocks.map(function getParamName(block: DocParamBlock): string {
    return block.parameterName;
  });
}

/**
 * Checks whether a function-like node has a non-void return type or return statements.
 *
 * @param node - AST node to inspect
 * @returns true when function appears to return a value
 */
export function functionReturnsValue(node: Span & Record<string, unknown>): boolean {
  // Check kind on the outer MethodDefinition BEFORE unwrapping to .value,
  // because `kind` ("constructor", "get", "set", "method") is a property
  // of MethodDefinition, not of the inner FunctionExpression.
  if (node.type === 'MethodDefinition' || node.type === 'TSAbstractMethodDefinition') {
    const kind = (node as Record<string, unknown>).kind as string | undefined;
    if (kind === 'constructor' || kind === 'set') {
      return false;
    }
  }

  const target = unwrapMethodDefinition(node);

  if (target === undefined) {
    return false;
  }

  // Check for explicit void/never return type annotation
  const returnType = target.returnType as Record<string, unknown> | undefined | null;
  if (returnType !== undefined && returnType !== null) {
    const typeAnnotation = returnType.typeAnnotation as Record<string, unknown> | undefined;
    if (typeAnnotation !== undefined) {
      const tsType = typeAnnotation.type as string | undefined;
      if (tsType === 'TSVoidKeyword' || tsType === 'TSNeverKeyword') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks whether a function-like node is a generator (has `generator: true`).
 *
 * @param node - AST node to inspect
 * @returns true when the function is a generator
 */
export function isGeneratorFunction(node: Span & Record<string, unknown>): boolean {
  const target = unwrapMethodDefinition(node);

  if (target === undefined) {
    return false;
  }

  return (target as Record<string, unknown>).generator === true;
}
