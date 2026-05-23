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
  readonly from: "package";
  readonly name: readonly string[];
  readonly package: string;
};

/** Package-type specifiers, grouped by SDK. */
export const packageAllowSpecifiers: readonly PackageSpecifier[] = [
  {
    from: "package",
    package: "h3",
    name: [
      "H3Event",
      "H3EventContext",
      "H3EventResponse",
      "EventHandler",
      "EventHandlerObject",
      "EventHandlerWithFetch",
      "H3",
    ],
  },
  {
    from: "package",
    package: "srvx",
    name: ["ServeHandle"],
  },
  {
    from: "package",
    package: "@tursodatabase/database",
    name: ["Client", "Database"],
  },
  {
    from: "package",
    package: "@lezer/common",
    name: ["Parser", "Tree"],
  },

  // TODO: Remove them when we get to fixing lint issues in module-logger.
  {
    from: "package",
    package: "@monochromatic-dev/module-logger",
    name: ["Logger"],
  },
  {
    from: "package",
    package: "@monochromatic-dev/module-logger/types",
    name: ["Logger"],
  },
  {
    from: "package",
    package: "chokidar",
    name: ["FSWatcher"],
  },
  {
    from: "package",
    package: "@oxlint/plugins",
    name: [
      // The plugin API AST nodes are visitor inputs whose shape is dictated
      // by the host linter; mutator methods are part of the plugin contract.
      // Context carries the report callback and options; the host owns its
      // shape. AST node interfaces (Class, Function, CallExpression, etc.)
      // are passed to visitor callbacks and cannot be wrapped readonly
      // without forking the @oxlint/plugins type tree.
      "ArrowFunctionExpression",
      "CallExpression",
      "Class",
      "Comment",
      "Context",
      "Directive",
      "ForInStatement",
      "Function",
      "FunctionBody",
      "MemberExpression",
      "Node",
      "Program",
      "RegExpLiteral",
      "Span",
      "Statement",
      "SwitchStatement",
      "Token",
      "TryStatement",
      "TSEnumDeclaration",
      "VariableDeclaration",
      // The matcher compares `symbol.escapedName`, not the surface name. The
      // ESTree namespace re-exports three types under bundler-renamed aliases
      // (`Node$1 as Node`, `Function$1 as Function`,
      // `PropertyKey$1 as PropertyKey`) because @oxlint/plugins also declares
      // oxc-style top-level Node/Function/PropertyKey. A param typed
      // `ESTree.Node` therefore carries escapedName `Node$1`, so the plain
      // names above match only the top-level (non-namespace) forms. See
      // TROUBLESHOOTING.oxlint-prefer-readonly-estree.md.
      "Node$1",
      "Function$1",
      "PropertyKey$1",
    ],
  },
  {
    from: "package",
    package: "toml-eslint-parser",
    name: [
      // toml-eslint-parser exposes a mutable CST through the `AST.*`
      // namespace; consumers walk it read-only but the types are not
      // marked readonly upstream.
      "TOMLNode",
      "TOMLArray",
      "TOMLBare",
      "TOMLDottedValue",
      "TOMLKey",
      "TOMLKeyValue",
      "TOMLProgram",
      "TOMLQuoted",
      "TOMLStringValue",
      "TOMLTable",
      "TOMLTopLevelTable",
      "TOMLValue",
    ],
  },
  {
    // Buffer and the `NodeJS.*` namespace are declared in @types/node,
    // not the TypeScript standard lib.
    from: "package",
    package: "@types/node",
    name: ["Buffer", "ProcessEnv", "ReadableStream", "WritableStream"],
  },
  {
    from: "package",
    package: "@earendil-works/pi-coding-agent",
    name: [
      // pi-coding-agent SDK types are visitor inputs for extension code; the
      // host owns their shape. ExtensionAPI carries registry mutators
      // (registerTool, registerCommand, setActiveTools), SessionEntry
      // variants retain writable fields, ModelRegistry exposes auth lookup,
      // and ExtensionContext/ExtensionCommandContext are passed through to
      // host components whose contracts predate readonly conventions.
      "ExtensionAPI",
      "ExtensionContext",
      "ExtensionCommandContext",
      "SessionEntry",
      "ModelRegistry",
    ],
  },
  {
    from: "package",
    package: "@earendil-works/pi-ai",
    name: [
      // pi-ai provider/message types are dictated by the upstream SDK;
      // AssistantMessage carries a mutable `content` array of TextContent/
      // ThinkingContent/ToolCall blocks that the upstream type does not
      // mark readonly.
      "AssistantMessage",
    ],
  },
  {
    from: "package",
    package: "@earendil-works/pi-agent-core",
    name: [
      // pi-agent-core defines AgentMessage as the union of pi-ai Message
      // variants plus host-augmented CustomAgentMessages (BashExecution,
      // BranchSummary, etc.); the union members are owned by their
      // respective packages and carry mutable content arrays.
      "AgentMessage",
    ],
  },
];
