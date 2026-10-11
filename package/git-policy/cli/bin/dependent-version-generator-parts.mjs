/**
 Parts of a generated workspace for the dependent-version differential harness: packages, their source files with
 every specifier form and decoy, and the registry configuration.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { release } from './dependent-version-manifest-text.mjs';

/** @typedef {import('./dependent-version-random.mjs').Tool} Tool */
/** @typedef {import('./dependent-version-manifest-text.mjs').GeneratedPackage} GeneratedPackage */

/** Source file names: every extension, tests, declarations and files that are not source. */
const sourceNames = [
  'index.ts',
  'lib/a.tsx',
  'b.mts',
  'c.cts',
  'd.js',
  'e.jsx',
  'f.mjs',
  'g.cjs',
  'types.d.ts',
  'x.unit.test.ts',
  'h.test.helper.ts',
  'readme.md',
  'data.json',
  'deep/more/i.ts'
];
/** Versions that are not plain releases. */
const oddVersions = [
  '1.0.0-rc.1',
  '1.0',
  '01.0.0',
  '2.0.0+build'
];
/** Bytes that are not UTF-8. */
const undecodable = Buffer.from(
  '\u00FF\u00FE ',
  'latin1',
);
/** Upper bound on source files per package, exclusive. */
const sourceFilesBound = 4;
/** Upper bound on extra names mentioned per source file, exclusive. */
const mentionsBound = 4;
/** Probabilities of the parts' events. */
const odds = {
  version: 0.94,
  oddVersion: 0.08,
  undecodableSource: 0.05,
  emptyItem: 0.05,
  deepConfig: 0.5,
  crlfConfig: 0.1,
};

/**
 One generated package without edges or sources.

 @param {{ tool: Tool, index: number }} request - choices and package index
 @returns {GeneratedPackage} package
 */
export function generatedPackage({
  tool,
  index
}) {
  const suffix = String(index);
  const version = tool.chance(odds.oddVersion) ? tool.pick(oddVersions) : release(tool);
  return {
    name: tool.pick([
      `@g/p${suffix}`,
      `@g/p${suffix}`,
      `@g/p${suffix}0`,
      `@g/\u{E9}${suffix}`,
      `@g/\u{1D538}${suffix}`,
      `@g/\u{E000}${suffix}`,
      `plain-${suffix}`
    ]),
    directory: `package/${tool.pick([
      'module',
      'cli',
      'app',
      'lib'
    ])}/d${suffix}${tool.pick([
      '',
      '-x',
      '.y'
    ])}`,
    version: tool.chance(odds.version) ? version : undefined,
    edges: [],
    deep: false,
    sources: [],
  };
}

/** Statement forms of a source file: specifiers, then decoys. */
const forms = [
  function namedImport(/** @type {string} */ name) {
    return `import { x } from '${name}';`;
  },
  function sideEffect(/** @type {string} */ name) {
    return `import '${name}/ts';`;
  },
  function reexport(/** @type {string} */ name) {
    return `export * from "${name}";`;
  },
  function dynamic(/** @type {string} */ name) {
    return `const m = await import(\`${name}\`);`;
  },
  function required(/** @type {string} */ name) {
    return `const r = require ( '${name}' );`;
  },
  function typeImport(/** @type {string} */ name) {
    return `import type { T } from '${name}/sub';`;
  },
  function multiline(/** @type {string} */ name) {
    return `import {\n  y,\n}\nfrom\n'${name}';`;
  },
  function lineComment(/** @type {string} */ name) {
    return `// ${name}`;
  },
  function plainString(/** @type {string} */ name) {
    return `const s = '${name}';`;
  },
  function longer(/** @type {string} */ name) {
    return `const t = '${name}x';`;
  },
  function reimport(/** @type {string} */ name) {
    return `reimport '${name}';`;
  },
  function myrequire(/** @type {string} */ name) {
    return `myrequire('${name}');`;
  },
  function suffixed(/** @type {string} */ name) {
    return `from '${name}-extra';`;
  },
  function unterminated(/** @type {string} */ name) {
    return `import '${name}`;
  },
  function underscored(/** @type {string} */ name) {
    return `_import('${name}')`;
  },
];

/**
 Source files of a package that import some names and mention others without importing them. Names the package
 declares are drawn twice as often as other workspace names.

 @param {{ tool: Tool, pkg: GeneratedPackage, names: readonly string[] }} request - choices, package and workspace
   names
 @returns {{ path: string, bytes: Buffer }[]} source files
 */
export function sourceFiles({
  tool,
  pkg,
  names
}) {
  const declared = pkg.edges
    .map(function nameOf(edge) {
    return edge.name;
  });
  return tool.shuffled(sourceNames)
    .slice(
      0,
      tool.below(sourceFilesBound)
    )
    .map(function sourceFile(fileName) {
      const mentioned = tool.shuffled([
        ...declared,
        ...declared,
        ...names
      ])
        .slice(
          0,
          1 + tool.below(mentionsBound)
        );
      const text = Buffer.from(
        mentioned.map(function statement(name) {
        return tool.pick(forms)(name);
      })
          .join(tool.pick([
            '\n',
            '\r\n',
            ' '
          ])),
        'utf8'
      );
      return {
        path: `${pkg.directory}/src/${fileName}`,
        bytes: tool.chance(odds.undecodableSource) ? Buffer.concat([
          undecodable,
          text
        ]) : text,
      };
    });
}

/**
 The registry configuration listing the publishable names.

 @param {{ tool: Tool, names: readonly string[] }} request - choices and publishable names
 @returns {string} configuration text
 */
export function configText({
  tool,
  names
}) {
  const items = names.map(function toItem(name) {
    return `- '${name}'`;
  });
  if (tool.chance(odds.emptyItem))
    items.splice(
      tool.below(items.length + 1),
      0,
      "- ''"
    );
  const deep = tool.chance(odds.deepConfig);
  const listed = items.map(function indent(item) {
    return deep ? `            ${item}` : `  ${item}`;
  })
    .join('\n');
  const text = deep
    ? `storage: /s\nauth:\n  oidc:\n    - workloads:\n        - registry: r\n          packages:\n${listed}\n\nweb:\n  enable: false\n`
    : `packages:\n${listed}\nnext: 1\n`;
  return tool.chance(odds.crlfConfig) ? text.replaceAll(
    '\n',
    '\r\n'
  ) : text;
}
