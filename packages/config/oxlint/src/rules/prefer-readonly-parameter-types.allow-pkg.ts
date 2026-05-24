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
      "Variable",
      "VariableDeclaration",
      // The matcher compares `symbol.escapedName`, not the surface name. The
      // ESTree namespace re-exports three types under bundler-renamed aliases
      // (`Node$1 as Node`, `Function$1 as Function`,
      // `PropertyKey$1 as PropertyKey`) because @oxlint/plugins also declares
      // oxc-style top-level Node/Function/PropertyKey. A param typed
      // `ESTree.Node` therefore carries escapedName `Node$1`, so the plain
      // names above match only the top-level (non-namespace) forms. See
      // docs/troubleshooting/oxlint-prefer-readonly-estree.md.
      "Node$1",
      "Function$1",
      "PropertyKey$1",
    ],
  },
  {
    // rolldown/utils re-exports `import * as ESTree from "@oxc-project/types"`,
    // so ESTree.* params in rolldown plugins resolve to @oxc-project/types,
    // not @oxlint/plugins. These are top-level module exports with no bundler
    // renaming, so the plain names match (no `$1` suffixes here).
    from: "package",
    package: "@oxc-project/types",
    name: [
      "ExportAllDeclaration",
      "ExportNamedDeclaration",
      "Expression",
      "ImportAttribute",
      "ImportDeclaration",
      "ImportExpression",
      "PropertyKey",
      "StringLiteral",
    ],
  },
  {
    // postcss AST nodes (Root/AtRule/ChildNode) are walked in-place by plugin
    // visitors; the postcss API hands them in mutable and consumers call
    // node.walk*/append/remove on them, so readonly is wrong here.
    //
    // postcss declares each node as `class X_ extends ...` plus an empty
    // `class X extends X_ {}` re-exported via `export = X`. tsgo resolves a
    // param typed `Root`/`AtRule` to the BASE symbol (`Root_`/`AtRule_`), so
    // the matcher needs the underscore names; the plain names are kept too so
    // the entry self-heals if tsgo stops collapsing to the base. ChildNode is
    // a plain exported union alias and matches directly. Verified empirically
    // against tsgolint 0.23.0 with a postcss param probe.
    from: "package",
    package: "postcss",
    name: [
      "AtRule",
      "AtRule_",
      "ChildNode",
      "Root",
      "Root_",
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
