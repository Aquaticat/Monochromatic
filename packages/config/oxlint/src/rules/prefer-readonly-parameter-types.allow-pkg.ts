/**
 * Package-type specifiers for `typescript/prefer-readonly-parameter-types`.
 *
 * Lists third-party SDK types whose mutable shape is dictated by the
 * upstream library and not under our control. Used by
 * ./prefer-readonly-parameter-types.ts.
 *
 * @example
 * ```typescript
 * import { packageAllowSpecifiers } from './prefer-readonly-parameter-types.allow-pkg.ts';
 * ```
 */

/**
 * Specifier object shape for `from: 'package'`. Re-typed locally to avoid
 * pulling in tsgolint internals.
 */
type PackageSpecifier = {
  readonly from: 'package';
  readonly name: readonly string[];
  readonly package: string;
};

/** Package-type specifiers, grouped by SDK. */
export const packageAllowSpecifiers: readonly PackageSpecifier[] = [
  {
    from: 'package',
    package: 'h3',
    name: [
      'H3Event',
      'H3EventContext',
      'H3EventResponse',
      'EventHandler',
      'EventHandlerObject',
      'EventHandlerWithFetch',
    ],
  },
  {
    from: 'package',
    package: 'srvx',
    name: [
      'ServeHandle',
    ],
  },
  {
    from: 'package',
    package: '@tursodatabase/database',
    name: [
      'Client',
      'Database',
    ],
  },
  {
    from: 'package',
    package: '@oxlint/plugins',
    name: [
      // The plugin API AST nodes are visitor inputs whose shape is dictated
      // by the host linter; mutator methods are part of the plugin contract.
      'Span',
      'Comment',
      'Node',
      'Token',
    ],
  },
  {
    from: 'package',
    package: 'toml-eslint-parser',
    name: [
      // toml-eslint-parser exposes a mutable CST through the `AST.*`
      // namespace; consumers walk it read-only but the types are not
      // marked readonly upstream.
      'TOMLNode',
      'TOMLArray',
      'TOMLBare',
      'TOMLDottedValue',
      'TOMLKey',
      'TOMLKeyValue',
      'TOMLProgram',
      'TOMLQuoted',
      'TOMLStringValue',
      'TOMLTable',
      'TOMLTopLevelTable',
      'TOMLValue',
    ],
  },
  {
    // Buffer and the `NodeJS.*` namespace are declared in @types/node,
    // not the TypeScript standard lib.
    from: 'package',
    package: '@types/node',
    name: [
      'Buffer',
      'ProcessEnv',
      'ReadableStream',
      'WritableStream',
    ],
  },
  {
    from: 'package',
    package: 'estree',
    name: [
      'Node',
      'Program',
      'Statement',
      'Expression',
      'Identifier',
      'Pattern',
      'Comment',
      'CallExpression',
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'VariableDeclaration',
      'VariableDeclarator',
      'BlockStatement',
      'ReturnStatement',
      'IfStatement',
      'BinaryExpression',
      'MemberExpression',
      'Literal',
      'ObjectExpression',
      'ArrayExpression',
      'ImportDeclaration',
      'ExportNamedDeclaration',
      'ExportDefaultDeclaration',
      'Property',
      'TemplateLiteral',
      'TaggedTemplateExpression',
      'AssignmentExpression',
      'UpdateExpression',
      'UnaryExpression',
      'NewExpression',
      'ConditionalExpression',
      'LogicalExpression',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'SwitchStatement',
      'SwitchCase',
      'TryStatement',
      'CatchClause',
      'ThrowStatement',
      'ClassDeclaration',
      'ClassExpression',
      'MethodDefinition',
      'PropertyDefinition',
    ],
  },
];
