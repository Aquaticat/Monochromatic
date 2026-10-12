/**
 The function-level scenarios of the incumbent dependent-version unit tests, as differential cases.

 Sources, under `package/git-policy/repository/src`: `dependent-version-bump.unit.test.ts`,
 `manifest-text.unit.test.ts`, `source-imports.unit.test.ts`, and the `readPublishableNames` cases of
 `dependent-version-bump-policy.unit.test.ts`. Each case keeps its unit test's assertion as `expected`, compared with
 the incumbent's result by `matches`: a whole result, or the named fields of one.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { graphCases } from './dependent-version-unit-graph.mjs';

/** @typedef {import('./dependent-version-types.mjs').DifferentialCase} DifferentialCase */
/** @typedef {DifferentialCase & { expected: Record<string, unknown>, whole: boolean }} UnitCase */

/** Versions `patchBumpVersion` rejects. */
const rejectedVersions = [
  '1.0.0-alpha.1',
  '1.0.0+build',
  '01.0.0',
  '1.0',
  '1.0.x',
  '',
];

/**
 The cases of `dependent-version-bump.unit.test.ts`.

 @returns {UnitCase[]} cases
 */
function bumpCases() {
  return [
    {
      name: 'patchBumpVersion increments 1.2.3',
      kind: 'patchBumpVersion',
      input: {
        name: 'a',
        version: '1.2.3',
      },
      expected: {
        kind: 'ok',
        value: '1.2.4',
      },
      whole: true,
    },
    {
      name: 'patchBumpVersion increments 0.0.9',
      kind: 'patchBumpVersion',
      input: {
        name: 'a',
        version: '0.0.9',
      },
      expected: {
        kind: 'ok',
        value: '0.0.10',
      },
      whole: true,
    },
    ...rejectedVersions.map(function rejection(version) {
      return /** @type {UnitCase} */ ({
        name: `patchBumpVersion rejects ${JSON.stringify(version)}`,
        kind: 'patchBumpVersion',
        input: {
          name: '@scope/a',
          version,
        },
        expected: { kind: 'unsupported' },
        whole: false,
      });
    }),
  ];
}

const formatted = '{\n  "name": "a",\n  "description": "version \\"x\\"",\n  "publishConfig": { "version": "9.9.9" },\n  "version" :  "1.0.0",\n  "tail": ["version"]\n}\n';

/**
 The cases of `manifest-text.unit.test.ts`.

 @returns {UnitCase[]} cases
 */
function manifestCases() {
  /** @type {[string, string, Record<string, unknown>, boolean][]} */
  const facts = [
    [
      'reads name, version, runtime fields in order, and development names',
      JSON.stringify({
        name: '@scope/a',
        version: '1.0.0',
        dependencies: { '@scope/b': 'workspace:*' },
        peerDependencies: { '@scope/c': '*' },
        optionalDependencies: { '@scope/d': '*' },
        devDependencies: { '@scope/e': 'workspace:*' }
      }),
      {
        kind: 'facts',
        name: '@scope/a',
        version: '1.0.0',
        runtime: [
          '@scope/b',
          '@scope/c',
          '@scope/d'
        ],
        dev: ['@scope/e']
      },
      true,
    ],
    [
      'omits an absent version and treats non-object dependency fields as empty',
      '{"name":"a","dependencies":["b"]}',
      {
        kind: 'facts',
        name: 'a',
        version: null,
        runtime: [],
        dev: []
      },
      true
    ],
    [
      'rejects manifest that is not a JSON object',
      '[]',
      { error: 'shape' },
      false
    ],
    [
      'rejects manifest that has no string "name"',
      '{"version":"1.0.0"}',
      { error: 'shape' },
      false
    ],
    [
      'rejects manifest that has a non-string "version"',
      '{"name":"a","version":1}',
      { error: 'shape' },
      false
    ],
  ];
  /** @type {[string, string, Record<string, unknown>, boolean][]} */
  const rewrites = [
    [
      'changes only the top-level version value and keeps formatting',
      formatted,
      {
        kind: 'ok',
        value: formatted.replace(
          '"version" :  "1.0.0"',
          '"version" :  "1.0.1"'
        )
      },
      true
    ],
    [
      'rejects manifest that declares a different version',
      '{"version":"2.0.0"}',
      { error: 'shape' },
      false
    ],
    [
      'rejects manifest that has no top-level version',
      '{"name":"a","nested":{"version":"1.0.0"}}',
      { error: 'shape' },
      false
    ],
    [
      'rejects manifest that has a non-string version',
      '{"version":1}',
      { error: 'shape' },
      false
    ],
    [
      'rejects manifest that ends inside a string literal',
      '{"name":"a',
      { error: 'shape' },
      false
    ],
  ];
  return [
    ...facts.map(function toCase([title, text, expected, whole]) {
      return /** @type {UnitCase} */ ({
        name: `readManifestDependencyFacts ${title}`,
        kind: 'readManifestDependencyFacts',
        input: {
          path: whole ? 'package.json' : 'package/module/a/package.json',
          text,
        },
        expected,
        whole,
      });
    }),
    ...rewrites.map(function toCase([title, text, expected, whole]) {
      return /** @type {UnitCase} */ ({
        name: `replaceManifestVersion ${title}`,
        kind: 'replaceManifestVersion',
        input: {
          path: 'package.json',
          text,
          from: '1.0.0',
          to: '1.0.1',
        },
        expected,
        whole,
      });
    }),
  ];
}

/** Sources `importsPackage` detects, then ones it ignores. */
const detected = [
  "import { a } from '@scope/b';",
  'import type { A } from "@scope/b/ts";',
  "import '@scope/b';",
  "export * from '@scope/b';",
  "const m = await import('@scope/b');",
  'const m = await import ( `@scope/b/sub` );',
  "const m = require('@scope/b');",
  "import { a }\nfrom\n'@scope/b';",
  "const note = '@scope/b';\nimport { a } from '@scope/b';",
];

/** Sources `importsPackage` ignores. */
const ignored = [
  "import { a } from '@scope/bc';",
  "const name = '@scope/b';",
  "reimport '@scope/b';",
  "myrequire('@scope/b');",
  "import { a } from 'x@scope/b';",
  '@scope/b',
  '',
];

/**
 Paths `isNonTestSourcePath` decides for `package/module/a`.

 @type {[string, boolean][]}
 */
const sourcePaths = [
  [
    'package/module/a/src/index.ts',
    true
  ],
  [
    'package/module/a/src/deep/view.tsx',
    true
  ],
  [
    'package/module/a/src/index.unit.test.ts',
    false
  ],
  [
    'package/module/a/src/README.md',
    false
  ],
  [
    'package/module/a/test/index.ts',
    false
  ],
  [
    'package/module/ab/src/index.ts',
    false
  ],
];

/**
 Configurations `readPublishableNames` reads, with their names.

 @type {[string, string[]][]}
 */
const configurations = [
  [
    "a: 1\n  packages:\n    - '@s/a'\n    - '@s/b'\n  other: x\n    - '@s/c'\n",
    [
      '@s/a',
      '@s/b'
    ]
  ],
  [
    "packages:\n  - '@s/a'",
    ['@s/a']
  ],
  [
    'no list here\n',
    []
  ],
  [
    "packages:\n  - ''\n",
    []
  ],
];

/**
 The cases of `source-imports.unit.test.ts`.

 @returns {UnitCase[]} cases
 */
function scanCases() {
  return [
    ...[
      ...detected,
      ...ignored
    ].map(function toCase(sourceText) {
      const found = detected.includes(sourceText);
      return /** @type {UnitCase} */ ({
        name: `importsPackage ${found ? 'detects' : 'ignores'} ${JSON.stringify(sourceText)}`,
        kind: 'importsPackage',
        input: {
          sourceText,
          packageName: '@scope/b',
        },
        expected: {
          kind: 'bool',
          value: found,
        },
        whole: true,
      });
    }),
    ...sourcePaths.map(function toCase([path, accepted]) {
      return /** @type {UnitCase} */ ({
        name: `isNonTestSourcePath ${accepted ? 'accepts' : 'rejects'} ${path}`,
        kind: 'isNonTestSourcePath',
        input: {
          directory: 'package/module/a',
          path,
        },
        expected: {
          kind: 'bool',
          value: accepted,
        },
        whole: true,
      });
    }),
  ];
}

/**
 The `readPublishableNames` cases of `dependent-version-bump-policy.unit.test.ts`.

 @returns {UnitCase[]} cases
 */
export function publishableScenarios() {
  return configurations.map(function toCase([configText, names]) {
    return /** @type {UnitCase} */ ({
      name: `readPublishableNames reads ${JSON.stringify(configText)}`,
      kind: 'readPublishableNames',
      input: { configText },
      expected: {
        kind: 'names',
        value: names,
      },
      whole: true,
    });
  });
}

/**
 Every function-level scenario except the publishable-name ones, with its assertion.

 @returns {UnitCase[]} cases
 */
export function functionScenarios() {
  return [
    ...bumpCases(),
    ...graphCases(),
    ...manifestCases(),
    ...scanCases(),
  ];
}
