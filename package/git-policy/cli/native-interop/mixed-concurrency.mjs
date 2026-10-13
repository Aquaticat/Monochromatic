/**
 Mixed concurrency: incumbent and native commits racing on one repository.

 Usage: `mixed-concurrency.mjs [--wrappers=mixed|native|incumbent] [--only=disjoint|hooked|killed] [seed...]` (seeds 1 to 3 by default; `mixed` by
 default, the other two are single-wrapper controls that show which failures belong to the mixture). For each seed,
 the driver assigns the two wrappers to workers in a seeded order, staggers their starts with seeded delays, and runs three scenarios:

 - `disjoint`: eight workers, each committing its own file twice with an explicit path, while two more workers
   `git add` their own files and run `git status`.
 - `hooked`: six workers commit through a `pre-commit` hook (`hook.interop.command`) that logs its start and end;
   hook runs must never overlap, whichever wrapper started them, because concurrent commits are off by default
   (a replay after a lost landing race runs the hook again, so the run count is at least one per commit).
 - `killed`: six workers commit while one is killed at a seeded transaction phase; the survivors land, a recovery
   by each wrapper leaves nothing behind, and the dead commit landed whole or not at all.

 After every scenario: every non-killed worker exited 0, each landed commit changes exactly its own path,
 `git fsck` is clean, the history is linear, the real index agrees with `HEAD`, and nothing is left behind.
 Failures are collected and reported at the end.
 */
/// <reference types="node" />
import {
  chmod,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  createMatrix,
  createRepository,
  leftovers,
  realGit,
  runEnvironment,
  runThrough,
  run,
  sleep,
  startThrough,
  REAL_GIT,
} from './support.mjs';

const matrix = createMatrix();

/** Debug diagnostics for the `killed` scenario, printed in full for every worker that did not exit 0 (`--verbose`). */
const verbose = process.argv.includes('--verbose');

/** Which wrappers the workers use: both, or one for a control run. */
const wrapperMode = process.argv.find(function isMode(argument) {
  return argument.startsWith('--wrappers=');
})?.slice('--wrappers='.length) ?? 'mixed';

/** The six phases a worker can be killed at. */
const KILL_PHASES = [
  'capture-locked',
  'preparation-done',
  'landing-locked',
  'objects-migrated',
  'ref-updated',
  'index-installed',
];

/**
 Seeded pseudo-random source (a 32-bit linear congruential generator), so a failing seed repeats.

 @param {number} seed - starting value
 @returns {() => number} next value in the half-open range from 0 to 1
 */
function seeded(seed) {
  let state = (seed * 2_654_435_761) >>> 0;
  return function next() {
    state = ((state * 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

/**
 Assign wrappers to workers: half and half, in a seeded order.

 @param {{ count: number, random: () => number }} request - number of workers and the random source
 @returns {('incumbent' | 'native')[]} wrapper per worker
 */
function assignWrappers({
  count,
  random,
}) {
  /** @type {('incumbent' | 'native')[]} */
  const wrappers = Array.from(
    { length: count },
    function wrapperAt(_, index) {
      if (wrapperMode === 'native' || wrapperMode === 'incumbent')
        return wrapperMode;
      return index % 2 === 0 ? 'incumbent' : 'native';
    },
  );
  for (let index = wrappers.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [wrappers[index], wrappers[other]] = [wrappers[other], wrappers[index]];
  }
  return wrappers;
}

/**
 Check the invariants every scenario ends with.

 @param {{ tag: string, fixture: Awaited<ReturnType<typeof createRepository>>, base: string, expectedPaths: readonly string[],
   allowMissing?: boolean, staleLocks?: boolean }} request - label, repository, `HEAD` before the workers, paths each
   landed commit may change one of, whether some of them may be missing (a killed worker), and whether a dead
   holder's lock directory may remain (no command since took that lock)
 */
async function assertInvariants({
  tag,
  fixture,
  base,
  expectedPaths,
  allowMissing = false,
  staleLocks = false,
}) {
  const merges = await realGit(
    fixture,
    ['rev-list', '--merges', `${base}..HEAD`],
  );
  matrix.check({
    condition: merges === '',
    message: `${tag}: the history is linear`,
  });
  const listing = (await realGit(
    fixture,
    ['log', '--reverse', '--name-only', '--format=commit:%s', `${base}..HEAD`],
  )).split('\n').filter(Boolean);
  /** @type {string[][]} */
  const changes = [];
  for (const line of listing) {
    if (line.startsWith('commit:'))
      changes.push([]);
    else
      changes.at(-1)?.push(line);
  }
  matrix.check({
    condition: changes.every(function isSingle(paths) {
      return paths.length === 1 && expectedPaths.includes(String(paths[0]));
    }),
    message: `${tag}: each landed commit changes exactly one expected path (${changes.length} commits)`,
  });
  if (!allowMissing) {
    matrix.check({
      condition: changes.length === expectedPaths.length,
      message: `${tag}: ${String(changes.length)} commits landed, expected ${String(expectedPaths.length)}`,
    });
  }
  const fsck = await run({
    command: REAL_GIT,
    args: ['fsck', '--no-dangling'],
    cwd: fixture.repository,
    env: runEnvironment({ home: fixture.home }),
  });
  matrix.check({
    condition: fsck.status === 0,
    message: `${tag}: git fsck is clean (${fsck.stderr.trim().slice(0, 300)})`,
  });
  const left = await leftovers(
    fixture,
    { staleLocks },
  );
  matrix.check({
    condition: left.length === 0,
    message: `${tag}: nothing is left behind (${left.join(', ') || 'none'})`,
  });
}

/**
 Wait a seeded delay.

 @param {() => number} random - random source
 @param {number} limitMs - exclusive upper bound
 */
async function jitter(random, limitMs) {
  await sleep(Math.floor(random() * limitMs));
}

/**
 Scenario `disjoint`.

 @param {{ seed: number }} request - seed
 */
async function disjoint({ seed }) {
  const random = seeded(seed);
  const tag = `seed ${seed} disjoint`;
  const fixture = await createRepository({ name: `mixed-disjoint-${seed}` });
  const base = await realGit(
    fixture,
    ['rev-parse', 'HEAD'],
  );
  const wrappers = assignWrappers({
    count: 10,
    random,
  });
  const committers = wrappers.slice(
    0,
    8,
  );
  const adders = wrappers.slice(8);
  const paths = committers.map(function pathOf(_, index) {
    return `w${String(index)}.txt`;
  });
  const results = await Promise.all([
    ...committers.map(async function committer(wrapper, index) {
      await jitter(
        random,
        400,
      );
      const outcomes = [];
      for (const round of [1, 2]) {
        await writeFile(
          join(
            fixture.repository,
            String(paths[index]),
          ),
          `${wrapper} ${String(index)} round ${String(round)}\n`,
        );
        outcomes.push(await runThrough({
          wrapper,
          fixture,
          args: [
            'commit',
            '--quiet',
            `--message=${wrapper} w${String(index)} r${String(round)}`,
            '--',
            String(paths[index]),
          ],
        }));
      }
      return {
        label: `committer ${String(index)} (${wrapper})`,
        outcomes,
      };
    }),
    ...adders.map(async function adder(wrapper, index) {
      await jitter(
        random,
        400,
      );
      await writeFile(
        join(
          fixture.repository,
          `added${String(index)}.txt`,
        ),
        `added ${String(index)}\n`,
      );
      const outcomes = [
        await runThrough({
          wrapper,
          fixture,
          args: ['add', '--', `added${String(index)}.txt`],
        }),
        await runThrough({
          wrapper,
          fixture,
          args: ['status', '--porcelain'],
        }),
      ];
      return {
        label: `adder ${String(index)} (${wrapper})`,
        outcomes,
      };
    }),
  ]);
  for (const result of results) {
    for (const outcome of result.outcomes) {
      matrix.check({
        condition: outcome.status === 0,
        message: `${tag}: ${result.label} exited 0 (status ${String(outcome.status)}; ${outcome.stderr.trim().slice(0, 300)})`,
      });
    }
  }
  const expectedPaths = committers.flatMap(function twice(_, index) {
    return [String(paths[index]), String(paths[index])];
  });
  await assertInvariants({
    tag,
    fixture,
    base,
    expectedPaths,
  });
  for (const [index, wrapper] of committers.entries()) {
    matrix.check({
      condition: (await realGit(
        fixture,
        ['show', `HEAD:${String(paths[index])}`],
      )) === `${wrapper} ${String(index)} round 2`,
      message: `${tag}: ${String(paths[index])} holds its final round`,
    });
  }
  const staged = await realGit(
    fixture,
    ['diff', '--cached', '--name-only'],
  );
  matrix.check({
    condition: staged === adders.map(function addedName(_, index) {
      return `added${String(index)}.txt`;
    }).sort().join('\n'),
    message: `${tag}: exactly the added paths are staged (${staged.replaceAll('\n', ' ')})`,
  });
}

/**
 Scenario `hooked`.

 @param {{ seed: number }} request - seed
 */
async function hooked({ seed }) {
  const random = seeded(seed + 100);
  const tag = `seed ${seed} hooked`;
  const fixture = await createRepository({ name: `mixed-hooked-${seed}` });
  const base = await realGit(
    fixture,
    ['rev-parse', 'HEAD'],
  );
  const log = join(
    fixture.root,
    'hook.log',
  );
  const hook = join(
    fixture.root,
    'hook.sh',
  );
  await writeFile(
    hook,
    [
      '#!/bin/sh',
      `echo "start $$" >> '${log}'`,
      'sleep 0.3',
      `echo "end $$" >> '${log}'`,
      '',
    ].join('\n'),
  );
  await chmod(
    hook,
    0o700,
  );
  // Git's config-based hooks name their event with `hook.<name>.event`, per git-hook(1).
  await realGit(
    fixture,
    ['config', 'hook.interop.command', hook],
  );
  await realGit(
    fixture,
    ['config', 'hook.interop.event', 'pre-commit'],
  );
  const wrappers = assignWrappers({
    count: 6,
    random,
  });
  const results = await Promise.all(wrappers.map(async function worker(wrapper, index) {
    await jitter(
      random,
      300,
    );
    await writeFile(
      join(
        fixture.repository,
        `h${String(index)}.txt`,
      ),
      `${wrapper}\n`,
    );
    return {
      wrapper,
      index,
      outcome: await runThrough({
        wrapper,
        fixture,
        args: [
          'commit',
          '--quiet',
          `--message=${wrapper} h${String(index)}`,
          '--',
          `h${String(index)}.txt`,
        ],
      }),
    };
  }));
  for (const result of results) {
    matrix.check({
      condition: result.outcome.status === 0,
      message: `${tag}: worker ${String(result.index)} (${result.wrapper}) exited 0 (status ${String(result.outcome.status)}; ${result.outcome.stderr.trim().slice(0, 300)})`,
    });
  }
  const lines = (await readFile(
    log,
    'utf8',
  ).catch(function noLog() {
    return '';
  })).split('\n').filter(Boolean);
  let open = 0;
  let overlapped = false;
  for (const line of lines) {
    open += line.startsWith('start') ? 1 : -1;
    if (open > 1)
      overlapped = true;
  }
  matrix.check({
    condition: !overlapped && open === 0 && lines.length >= 12,
    message: `${tag}: ${String(lines.length / 2)} complete hook runs for six commits, never two hooks at once (overlap ${String(overlapped)})`,
  });
  await assertInvariants({
    tag,
    fixture,
    base,
    expectedPaths: wrappers.map(function pathOf(_, index) {
      return `h${String(index)}.txt`;
    }),
  });
}

/**
 Scenario `killed`.

 @param {{ seed: number }} request - seed
 */
async function killed({ seed }) {
  const random = seeded(seed + 300);
  const tag = `seed ${seed} killed`;
  const fixture = await createRepository({ name: `mixed-killed-${seed}` });
  const base = await realGit(
    fixture,
    ['rev-parse', 'HEAD'],
  );
  const wrappers = assignWrappers({
    count: 6,
    random,
  });
  const victim = Math.floor(random() * wrappers.length);
  const phase = String(KILL_PHASES[Math.floor(random() * KILL_PHASES.length)]);
  const markers = join(
    fixture.root,
    'markers',
  );
  await mkdir(
    markers,
    { recursive: true },
  );
  const results = await Promise.all(wrappers.map(async function worker(wrapper, index) {
    await jitter(
      random,
      300,
    );
    await writeFile(
      join(
        fixture.repository,
        `k${String(index)}.txt`,
      ),
      `${wrapper}\n`,
    );
    return {
      wrapper,
      index,
      outcome: await runThrough({
        wrapper,
        fixture,
        args: [
          'commit',
          '--quiet',
          `--message=${wrapper} k${String(index)}`,
          '--',
          `k${String(index)}.txt`,
        ],
        extra: {
          ...(index === victim ? { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `${phase}:kill:${markers}` } : {}),
          ...(verbose ? { MONOCHROMATIC_VERBOSE: 'true' } : {}),
        },
      }),
    };
  }));
  const victimResult = results[victim];
  matrix.check({
    condition: victimResult?.outcome.signal === 'SIGKILL' || victimResult?.outcome.status === 137,
    message: `${tag}: worker ${String(victim)} (${victimResult?.wrapper}) was killed at ${phase} (status ${String(victimResult?.outcome.status)})`,
  });
  if (verbose && results.some(function failed(result) {
    return result.index !== victim && result.outcome.status !== 0;
  })) {
    // One merged timeline of every worker's diagnostic lines, oldest first.
    const timeline = results.flatMap(function linesOf(result) {
      return result.outcome.stderr.split('\n')
        .filter(function isDiagnostic(line) {
          return line.length > 0 && !line.includes('scanCandidateSequence');
        })
        .map(function labelled(line) {
          return `${result.index === victim ? 'VICTIM' : 'worker'} ${String(result.index)} (${result.wrapper}) ${line}`;
        });
    }).sort(function byTimestamp(left, right) {
      const leftStamp = /\[(?<stamp>\d{4}-[^\]]+)\]/u.exec(left)?.groups?.stamp ?? '';
      const rightStamp = /\[(?<stamp>\d{4}-[^\]]+)\]/u.exec(right)?.groups?.stamp ?? '';
      return leftStamp.localeCompare(rightStamp);
    });
    console.log(`--- timeline of ${fixture.root} (victim ${String(victim)} killed at ${phase}) ---\n${timeline.join('\n')}\n--- end ---`);
  }
  for (const result of results) {
    if (result.index === victim)
      continue;
    matrix.check({
      condition: result.outcome.status === 0,
      message: `${tag}: survivor ${String(result.index)} (${result.wrapper}) exited 0 (status ${String(result.outcome.status)}; ${result.outcome.stderr.trim().slice(0, 300)})`,
    });
  }
  // A recovery by each wrapper: whatever the survivors did not clear, a guarded command must.
  for (const wrapper of ['incumbent', 'native']) {
    const status = await runThrough({
      wrapper,
      fixture,
      args: ['status', '--porcelain'],
    });
    matrix.check({
      condition: status.status === 0,
      message: `${tag}: ${wrapper} git status succeeds afterwards (status ${String(status.status)}; ${status.stderr.trim().slice(0, 300)})`,
    });
  }
  const subjects = (await realGit(
    fixture,
    ['log', '--format=%s', `${base}..HEAD`],
  )).split('\n').filter(Boolean);
  const victimLanded = subjects.some(function isVictim(subject) {
    return subject.endsWith(` k${String(victim)}`);
  });
  const landedPhase = phase === 'ref-updated' || phase === 'index-installed';
  matrix.check({
    condition: !landedPhase || victimLanded,
    message: `${tag}: a commit killed at ${phase} landed whole (landed: ${String(victimLanded)})`,
  });
  await assertInvariants({
    tag,
    fixture,
    base,
    expectedPaths: [
      ...wrappers.map(function pathOf(_, index) {
        return `k${String(index)}.txt`;
      }),
      'final-incumbent.txt',
      'final-native.txt',
    ],
    allowMissing: true,
    staleLocks: true,
  });
  // A command that takes the locks retires what the dead worker left, whichever wrapper runs it.
  for (const wrapper of ['incumbent', 'native']) {
    await writeFile(
      join(
        fixture.repository,
        `final-${wrapper}.txt`,
      ),
      'final\n',
    );
    const final = await runThrough({
      wrapper,
      fixture,
      args: [
        'commit',
        '--quiet',
        `--message=final ${wrapper}`,
        '--',
        `final-${wrapper}.txt`,
      ],
    });
    matrix.check({
      condition: final.status === 0,
      message: `${tag}: a final ${wrapper} commit lands (status ${String(final.status)}; ${final.stderr.trim().slice(0, 300)})`,
    });
  }
  const afterFinal = await leftovers(fixture);
  matrix.check({
    condition: afterFinal.length === 0,
    message: `${tag}: after the final commits no stale lock remains (${afterFinal.join(', ') || 'none'})`,
  });
  const present = (await realGit(
    fixture,
    ['ls-tree', '--name-only', 'HEAD'],
  )).split('\n');
  matrix.check({
    condition: wrappers.every(function landed(_, index) {
      return index === victim || present.includes(`k${String(index)}.txt`);
    }),
    message: `${tag}: every survivor's file is in HEAD`,
  });
}

const seeds = process.argv.slice(2).filter(function isSeed(argument) {
  return !argument.startsWith('--');
}).map(Number);
const only = process.argv.find(function isOnly(argument) {
  return argument.startsWith('--only=');
})?.slice('--only='.length);
for (const seed of seeds.length > 0 ? seeds : [1, 2, 3]) {
  if (only === undefined || only === 'disjoint')
    await disjoint({ seed });
  if (only === undefined || only === 'hooked')
    await hooked({ seed });
  if (only === undefined || only === 'killed')
    await killed({ seed });
}

matrix.finish();
console.log('mixed-concurrency passed');
