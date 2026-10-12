#!/usr/bin/env node
/**
 Differential check of real commits: the incumbent TypeScript wrapper (run from source) and the native wrapper
 commit the same change in two identical disposable repositories, and must agree on the exit code, the policy
 events on standard error, the commit that results, the index, and the worktree.

 Object names, timestamps and fixture paths differ between two repositories, so they are replaced by placeholders
 before the texts are compared; the trees compared are by content, so equal content has equal blob names.

 Usage: node bin/differential-commit.mjs [--native <path>] [--case <name>]
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { parseArgs } from 'node:util';

import {
  DifferentialError,
  hermeticEnvironment,
  observe,
  REAL_GIT,
  setupGit,
  writeFiles,
} from './differential-config-process.mjs';

/** The package directory, `package/git-policy/cli`. */
const packageDirectory = resolve(
  import.meta.dirname,
  '..',
);

/**
 One commit case: a baseline, the changes made before the commit, an optional hook, and the wrapped commands.

 @typedef {{
   name: string,
   baseline: Record<string, string>,
   changes: Record<string, string>,
   stage?: readonly string[],
   hook?: string,
   race?: { slow: readonly string[], fast: readonly string[], fastFiles: Record<string, string> },
   commands: readonly (readonly string[])[],
   paths: readonly string[],
 }} Case
 */

/** The cases: the commit shapes the plan names. */
const cases = /** @type {readonly Case[]} */ ([
  {
    name: 'final-newline-correction',
    baseline: { 'a.txt': 'one\n' },
    changes: { 'a.txt': 'one\ntwo' },
    commands: [
      [
        'commit',
        '--message=second',
        'a.txt',
      ],
    ],
    paths: ['a.txt'],
  },
  {
    name: 'pre-commit-restage',
    baseline: { 'a.txt': 'one\n' },
    changes: { 'a.txt': 'one\ntwo\n' },
    hook: '#!/bin/sh\nprintf "hooked\\n" >> a.txt\n/usr/bin/git add -- a.txt\n',
    commands: [
      [
        'commit',
        '--message=second',
        'a.txt',
      ],
    ],
    paths: ['a.txt'],
  },
  {
    name: 'no-change-normalization',
    baseline: { 'a.txt': 'one\n' },
    changes: { 'a.txt': 'one' },
    commands: [
      [
        'commit',
        '--message=second',
        'a.txt',
      ],
    ],
    paths: ['a.txt'],
  },
  {
    name: 'amend',
    baseline: { 'a.txt': 'one\n' },
    changes: { 'a.txt': 'one\ntwo\n' },
    commands: [
      [
        'commit',
        '--amend',
        '--message=amended',
        'a.txt',
      ],
    ],
    paths: ['a.txt'],
  },
  {
    name: 'all-tracked-changes',
    baseline: {
      'a.txt': 'one\n',
      'b.txt': 'b\n',
    },
    changes: {
      'a.txt': 'one\ntwo\n',
      'b.txt': 'b\nmore\n',
    },
    commands: [
      [
        'commit',
        '-a',
        '--no-only',
        '--message=all',
      ],
    ],
    paths: [
      'a.txt',
      'b.txt',
    ],
  },
  {
    name: 'concurrent-commit-replay',
    baseline: {
      'a.txt': 'one\n',
      'b.txt': 'b\n',
    },
    changes: { 'a.txt': 'one\ntwo\n' },
    race: {
      slow: [
        'commit',
        '--message=slow',
        'a.txt',
      ],
      fast: [
        'commit',
        '--message=fast',
        'b.txt',
      ],
      fastFiles: { 'b.txt': 'b\nfast\n' },
    },
    commands: [],
    paths: [
      'a.txt',
      'b.txt',
    ],
  },
  {
    name: 'blocked-by-commit-only',
    baseline: { 'a.txt': 'one\n' },
    changes: { 'a.txt': 'one\ntwo\n' },
    stage: ['a.txt'],
    commands: [
      [
        'commit',
        '--message=second',
      ],
    ],
    paths: ['a.txt'],
  },
]);

/**
 A wrapper under comparison.

 @typedef {{
   name: string,
   run: (args: readonly string[], extraEnvironment?: Record<string, string>) => ReturnType<typeof observe>,
 }} Runner
 */

/**
 One disposable repository with a wrapper ready to run in it.

 @typedef {{ root: string, home: string, run: Runner['run'] }} Fixture
 */

/**
 Build a repository with the case's baseline commit, hook, staged paths and uncommitted changes.

 @param {{ context: string, name: string, kase: Case, wrapper: 'incumbent' | 'native', native: string }} request -
   parent directory, label, case, wrapper kind and the native executable
 @returns {Promise<Fixture>} the ready fixture
 */
async function createFixture({
  context,
  name,
  kase,
  wrapper,
  native,
}) {
  const root = join(
    context,
    name,
  );
  const home = join(
    context,
    `${name}-home`,
  );
  await mkdir(
    root,
    { recursive: true },
  );
  await mkdir(home);
  await setupGit({
    root,
    home,
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
  });
  await writeFiles({
    root,
    files: kase.baseline,
  });
  await setupGit({
    root,
    home,
    args: [
      'add',
      '--all',
    ],
  });
  await setupGit({
    root,
    home,
    args: [
      'commit',
      '--quiet',
      '--message=baseline',
    ],
  });
  await writeFiles({
    root,
    files: kase.changes,
  });
  if (kase.stage !== undefined)
    await setupGit({
      root,
      home,
      args: [
        'add',
        '--',
        ...kase.stage,
      ],
    });
  if (kase.hook !== undefined) {
    const hook = join(
      root,
      '.git/hooks/pre-commit',
    );
    await mkdir(
      dirname(hook),
      { recursive: true },
    );
    await writeFile(
      hook,
      kase.hook,
    );
    await chmod(
      hook,
      0o755,
    );
  }
  const bin = join(
    context,
    `${name}-bin`,
  );
  await mkdir(bin);
  await symlink(
    native,
    join(
      bin,
      'git',
    ),
  );
  const path = wrapper === 'native' ? `${bin}:/usr/bin:/bin` : `/usr/bin:/bin:${dirname(process.execPath)}`;
  const environment = hermeticEnvironment({
    home,
    path,
  });
  return {
    root,
    home,
    run: function runWrapper(args, extra = {}) {
      return wrapper === 'native'
        ? observe({
          command: join(
            bin,
            'git',
          ),
          args,
          cwd: root,
          env: {
            ...environment,
            ...extra,
          },
        })
        : observe({
          command: process.execPath,
          args: [
            join(
              packageDirectory,
              'src/index.ts',
            ),
            ...args,
          ],
          cwd: root,
          env: {
            ...environment,
            ...extra,
          },
        });
    },
  };
}

/**
 Replace what two repositories legitimately differ in: object names, timestamps and the fixture paths.

 @param {string} text - captured text
 @param {readonly string[]} roots - fixture roots and homes to mask
 @returns {string} comparable text
 */
function normalize(
  text,
  roots,
) {
  const masked = roots.reduce(
    function maskRoot(
      current,
      root,
    ) {
      return current.replaceAll(
        root,
        '<root>',
      );
    },
    text,
  );
  // Diagnostic log lines (`[warn] ...`) are not part of the wrapper's JSONL contract and word their tags differently.
  return masked
    .split('\n')
    .filter(function isNotDiagnostic(line) {
      return !line.startsWith('[warn]') && !line.startsWith('[debug]');
    })
    .join('\n')
    .replaceAll(
      /\b[0-9a-f]{40}\b/gu,
      '<oid>',
    )
    .replaceAll(
      /\b[0-9a-f]{7,12}\b/gu,
      '<abbrev>',
    )
    .replaceAll(
      /\d{4}-\d\d-\d\dT[\d:.]+Z/gu,
      '<time>',
    );
}

/**
 What a fixture shows after the commands ran.

 @param {{ fixture: Fixture, kase: Case }} request - fixture and case
 @returns {Promise<Record<string, string>>} the observed repository state by label
 */
async function repositoryState({
  fixture,
  kase,
}) {
  const query = async function query(/** @type {readonly string[]} */ args) {
    const outcome = await observe({
      command: REAL_GIT,
      args,
      cwd: fixture.root,
      env: hermeticEnvironment({
        home: fixture.home,
        path: '/usr/bin:/bin',
      }),
    });
    return outcome.stdout + outcome.stderr;
  };
  const worktree = await Promise.all(kase.paths.map(async function read(path) {
    return `${path}=${JSON.stringify(await readFile(
      join(
        fixture.root,
        path,
      ),
      'utf8',
    ).catch(function absent() {
      return null;
    }))}`;
  }));
  return {
    count: await query([
      'rev-list',
      '--count',
      'HEAD',
    ]),
    subject: await query([
      'log',
      '-1',
      '--format=%s%n%an%n%ae',
    ]),
    tree: await query([
      'ls-tree',
      '-r',
      'HEAD',
    ]),
    index: await query([
      'ls-files',
      '--stage',
    ]),
    status: await query([
      'status',
      '--porcelain=v1',
    ]),
    worktree: worktree.join('\n'),
    leftovers: await query([
      'count-objects',
      '-v',
    ]).then(function keepKeeps(text) {
      return text.split('\n')
        .filter(function isGarbage(line) {
          return line.startsWith('garbage');
        })
        .join('\n');
    }),
  };
}

/**
 The step of a race case: the slow commit pauses after preparation, the fast commit lands, then the slow one resumes.
 The step's result joins both commits' exit codes, outputs and events in one observed value.

 @param {NonNullable<Case['race']>} race - the two commits and the fast commit's change
 @param {string} context - parent directory of the marker directories
 @returns {(fixture: Fixture) => ReturnType<typeof observe>} the step to run in each fixture
 */
function raceStep(
  race,
  context,
) {
  return async function runRace(fixture) {
    const markers = join(
      context,
      `markers-${fixture.root.split('/').at(-1) ?? 'x'}`,
    );
    await mkdir(markers);
    const slow = fixture.run(
      race.slow,
      { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `preparation-done:pause:${markers}` },
    );
    const reached = join(
      markers,
      'preparation-done.reached',
    );
    for (let polls = 0; polls < 6_000; polls += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Poll for the marker the paused commit writes.
      const present = await access(reached).then(function yes() {
        return true;
      }, function no() {
        return false;
      });
      if (present)
        break;
      // oxlint-disable-next-line no-await-in-loop -- The delay between polls.
      await new Promise(function pause(done) {
        setTimeout(
          done,
          20,
        );
      });
    }
    await writeFiles({
      root: fixture.root,
      files: race.fastFiles,
    });
    const fast = await fixture.run(race.fast);
    await writeFile(
      join(
        markers,
        'preparation-done.release',
      ),
      '',
    );
    const slowResult = await slow;
    return {
      code: slowResult.code * 100 + fast.code,
      stdout: `${fast.stdout}\n--slow--\n${slowResult.stdout}`,
      stderr: `${fast.stderr}\n--slow--\n${slowResult.stderr}`,
    };
  };
}

/**
 Run one case in both wrappers and report each difference.

 @param {{ context: string, kase: Case, native: string }} request - parent directory, case and the native executable
 @returns {Promise<readonly string[]>} one line per difference; empty when the wrappers agree
 */
async function runCase({
  context,
  kase,
  native,
}) {
  const [
    incumbent,
    nativeFixture,
  ] = await Promise.all([
    createFixture({
      context,
      name: `${kase.name}-incumbent`,
      kase,
      wrapper: 'incumbent',
      native,
    }),
    createFixture({
      context,
      name: `${kase.name}-native`,
      kase,
      wrapper: 'native',
      native,
    }),
  ]);
  const roots = [
    incumbent.root,
    incumbent.home,
    nativeFixture.root,
    nativeFixture.home,
  ];
  const differences = [];
  const steps = kase.race === undefined
    ? kase.commands.map(function plain(command) {
      return async function runPlain(/** @type {Fixture} */ fixture) {
        return fixture.run(command);
      };
    })
    : [raceStep(kase.race, context)];
  for (const step of steps) {
    const [
      left,
      right,
    ] = await Promise.all([
      step(incumbent),
      step(nativeFixture),
    ]);
    for (const [
      label,
      first,
      second,
    ] of [
      [
        'exit code',
        String(left.code),
        String(right.code),
      ],
      [
        'standard error',
        normalize(
          left.stderr,
          roots,
        ),
        normalize(
          right.stderr,
          roots,
        ),
      ],
      [
        'standard output',
        normalize(
          left.stdout,
          roots,
        ),
        normalize(
          right.stdout,
          roots,
        ),
      ],
    ])
      if (first !== second)
        differences.push(`${kase.name}: ${label} differs\n  incumbent: ${JSON.stringify(first)}\n  native:    ${JSON.stringify(second)}`);
  }
  const [
    leftState,
    rightState,
  ] = await Promise.all([
    repositoryState({
      fixture: incumbent,
      kase,
    }),
    repositoryState({
      fixture: nativeFixture,
      kase,
    }),
  ]);
  for (const label of Object.keys(leftState)) {
    const first = normalize(
      leftState[label] ?? '',
      roots,
    );
    const second = normalize(
      rightState[label] ?? '',
      roots,
    );
    if (first !== second)
      differences.push(`${kase.name}: ${label} differs\n  incumbent: ${JSON.stringify(first)}\n  native:    ${JSON.stringify(second)}`);
  }
  return differences;
}

/**
 Parse the options, run the selected cases, and fail on any difference.

 @returns {Promise<void>} resolves when every case agrees
 */
async function main() {
  const { values } = parseArgs({
    options: {
      native: {
        type: 'string',
        default: resolve(
          packageDirectory,
          'target/debug/cli-git-native',
        ),
      },
      case: { type: 'string', },
    },
  });
  const selected = cases.filter(function isSelected(candidate) {
    return values.case === undefined || candidate.name === values.case;
  });
  if (selected.length === 0)
    throw new DifferentialError(`No case is named ${String(values.case)}.`);
  const context = await mkdtemp(join(
    tmpdir(),
    'cli-git-commit-differential-',
  ));
  try {
    let failed = 0;
    for (const kase of selected) {
      // oxlint-disable-next-line no-await-in-loop -- Each case starts two Node processes and the host is shared.
      const differences = await runCase({
        context,
        kase,
        native: resolve(values.native),
      });
      console.log(`${differences.length === 0 ? 'EQUAL' : 'DIFF '} ${kase.name}`);
      for (const line of differences)
        console.log(line);
      failed += differences.length === 0 ? 0 : 1;
    }
    console.log(`${String(selected.length - failed)} of ${String(selected.length)} cases agree`);
    if (failed > 0)
      process.exitCode = 1;
  }
  finally {
    await rm(
      context,
      {
        recursive: true,
        force: true,
      },
    );
  }
}

await main();
