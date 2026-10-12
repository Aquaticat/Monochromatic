/**
 Candidate sets and probes of the repository-configuration differential.

 Each scenario is one representative change set; each probe is one non-commit command both wrappers run on it.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />

/** Policies the native wrapper refuses to evaluate against candidates yet, by registry name. */
export const UNPORTED_POLICIES = [
  'markdown/autofix',
  'mono/dependent-version-bump',
];

/** The five policies whose decisions depend on candidate content. */
export const CONTENT_POLICIES = [
  'final-newline',
  'security/forbidden-strings',
  'mono/forbidden-root-context',
  'markdown/autofix',
  'mono/dependent-version-bump',
];

/** Repeat count that makes a 32-byte object identifier in hexadecimal. */
const OBJECT_ID_BYTES = 32;

/**
 Text built from parts so this source never holds the literal a repository scan would match.

 @param {readonly string[]} parts - fragments joined in order
 @returns {string} the joined text
 */
function joined(parts) {
  return parts.join('');
}

/**
 One representative candidate set.
 `baseline` is committed first, `changes` are written afterwards as worktree edits or new files,
 `triggers` names the one policy the incumbent must report on `changes` (none for the control), and
 `addPaths` are what `git add` stages.

 @typedef {{
   name: string,
   triggers: string | undefined,
   baseline: Record<string, string>,
   changes: Record<string, string>,
   addPaths: readonly string[],
 }} Scenario
 */

/**
 Candidate sets covering each of the five content policies and a clean control.

 @type {readonly Scenario[]}
 */
export const scenarios = [
  {
    name: 'clean-control',
    triggers: undefined,
    baseline: {},
    changes: { 'clean.txt': 'clean\n' },
    addPaths: ['clean.txt'],
  },
  {
    name: 'missing-final-newline',
    triggers: 'final-newline',
    baseline: {},
    changes: { 'a.txt': 'a' },
    addPaths: ['a.txt'],
  },
  {
    name: 'forbidden-string-from-rules-file',
    triggers: 'security/forbidden-strings',
    baseline: {},
    changes: {
      'hit.txt': `${joined([
        'IN',
        'F:',
      ])} hit\n`,
    },
    addPaths: ['hit.txt'],
  },
  {
    name: 'forbidden-root-context',
    triggers: 'mono/forbidden-root-context',
    baseline: {},
    changes: { 'CONTEXT.md': '# Context\n' },
    addPaths: ['CONTEXT.md'],
  },
  {
    name: 'dependent-version-change',
    triggers: 'mono/dependent-version-bump',
    baseline: {
      'package/config/pnpr/config.yaml': "packages:\n  - '@fixture/a'\n  - '@fixture/b'\nnext: 1\n",
      'package/module/a/package.json': '{\n  "name": "@fixture/a",\n  "version": "1.0.0"\n}\n',
      'package/module/b/package.json': [
        '{',
        '  "name": "@fixture/b",',
        '  "version": "1.0.0",',
        '  "dependencies": {',
        '    "@fixture/a": "workspace:*"',
        '  }',
        '}',
        '',
      ].join('\n'),
    },
    changes: { 'package/module/a/package.json': '{\n  "name": "@fixture/a",\n  "version": "1.0.1"\n}\n' },
    addPaths: ['package/module/a/package.json'],
  },
  {
    name: 'markdown-autofix-touch',
    triggers: 'markdown/autofix',
    baseline: {
      '.gitattributes': '*.png filter=lfs diff=lfs merge=lfs -text\n',
      '.lfsconfig': '[lfs]\n\turl = https://lfs.example.invalid\n',
      'image.png': [
        'version https://git-lfs.github.com/spec/v1',
        `oid sha256:${'ab'.repeat(OBJECT_ID_BYTES)}`,
        'size 12',
        '',
      ].join('\n'),
    },
    changes: { 'doc.md': '# Doc\n\n![alt](image.png)\n' },
    addPaths: ['doc.md'],
  },
];

/**
 One command both wrappers run: a label, the arguments after `git`, and whether it changes files or the index.

 @typedef {{ label: string, args: readonly string[], mutates: boolean }} Probe
 */

/**
 The probes of one scenario.
 Direct commands run once with every configured policy and once per content policy, so a refusal for a policy the
 native wrapper does not implement yet cannot hide another policy's decision; `add` runs with every configured policy.
 Probes that change files or the index come last.

 @param {Scenario} scenario - candidates
 @returns {readonly Probe[]} probes in run order
 */
export function probesFor(scenario) {
  const checkAll = {
    label: 'check all policies',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    mutates: false,
  };
  const checks = CONTENT_POLICIES.map(function checkOne(policy) {
    return {
      label: `check ${policy}`,
      args: [
        'cli-git',
        'check',
        '--policy',
        policy,
        '--all',
      ],
      mutates: false,
    };
  });
  const fixes = CONTENT_POLICIES.map(function fixOne(policy) {
    return {
      label: `fix ${policy}`,
      args: [
        'cli-git',
        'fix',
        '--policy',
        policy,
        '--all',
      ],
      mutates: true,
    };
  });
  const add = {
    label: 'add',
    args: [
      'add',
      '--',
      ...scenario.addPaths,
    ],
    mutates: true,
  };
  return [
    checkAll,
    ...checks,
    ...fixes,
    add,
  ];
}
