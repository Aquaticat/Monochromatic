/**
 Disposable repositories of the repository-configuration differential.

 A fixture carries the repository's real `cli-git.config.ts` (read by the incumbent TypeScript wrapper) and real
 `cli-git.config.jsonc` (read by the native wrapper), the scanner at the path the incumbent configuration names,
 and the rules file where `rulesFile` names it.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import {
  copyFile,
  mkdir,
  readFile,
  symlink,
} from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

import {
  DifferentialError,
  hermeticEnvironment,
  observe,
  REAL_GIT,
  setupGit,
  writeFiles,
} from './differential-config-process.mjs';

/** The package directory, `package/git-policy/cli`. */
export const packageDirectory = resolve(
  import.meta.dirname,
  '..',
);

/** The repository top level that holds the real configuration files. */
export const repositoryRoot = resolve(
  packageDirectory,
  '../../..',
);

/** Where the rules file lives in a fixture, as `rulesFile` in the real configuration names it. */
export const RULES_FILE = '.cache/forbidden-strings.rules.txt';

/** Where the incumbent's real configuration looks for the scanner, relative to the repository root. */
export const SCANNER_PATH = 'package/cli/forbidden-strings/target/release/forbidden-strings';

/**
 The resolved inputs both wrappers need.

 @typedef {{
   native: string,
   scanner: string,
   lintDirectory: string | undefined,
   nodeDirectory: string,
 }} Tools
 */

/**
 One disposable repository with both wrappers ready to run in it.

 @typedef {{
   root: string,
   incumbent: (args: readonly string[]) => Promise<import('./differential-config-process.mjs').Observed>,
   native: (args: readonly string[]) => Promise<import('./differential-config-process.mjs').Observed>,
 }} Fixture
 */

/**
 Copy the repository's real files into a fixture and commit the baseline through real Git.

 @param {{ root: string, home: string, scenario: import('./differential-config-scenarios.mjs').Scenario, scanner: string }} request -
   fixture, disposable home, candidates and the scanner binary to link
 @returns {Promise<void>} resolves once the baseline is committed and the changes are written
 */
async function populate({
  root,
  home,
  scenario,
  scanner,
}) {
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
    files: {
      '.gitignore': 'node_modules\n.cache\ntarget\n',
      ...scenario.baseline,
    },
  });
  await mkdir(
    dirname(join(
      root,
      SCANNER_PATH,
    )),
    { recursive: true },
  );
  await mkdir(join(
    root,
    '.cache',
  ));
  await Promise.all([
    copyFile(
      join(
        repositoryRoot,
        'cli-git.config.ts',
      ),
      join(
        root,
        'cli-git.config.ts',
      ),
    ),
    copyFile(
      join(
        repositoryRoot,
        'cli-git.config.jsonc',
      ),
      join(
        root,
        'cli-git.config.jsonc',
      ),
    ),
    symlink(
      join(
        repositoryRoot,
        'node_modules',
      ),
      join(
        root,
        'node_modules',
      ),
    ),
    symlink(
      scanner,
      join(
        root,
        SCANNER_PATH,
      ),
    ),
    // Only the committed appendix: the generated file also carries embargoed local rules.
    copyFile(
      join(
        repositoryRoot,
        'forbidden-strings.append.txt',
      ),
      join(
        root,
        RULES_FILE,
      ),
    ),
  ]);
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
    files: scenario.changes,
  });
}

/**
 Build a fixture and trust the incumbent's configuration in it.

 @param {{ context: string, scenario: import('./differential-config-scenarios.mjs').Scenario, tools: Tools }} request -
   parent directory, candidates and tools
 @returns {Promise<Fixture>} the ready fixture
 */
export async function createFixture({
  context,
  scenario,
  tools,
}) {
  const root = join(
    context,
    scenario.name,
  );
  const home = join(
    context,
    `${scenario.name}-home`,
  );
  const nativeBin = join(
    context,
    `${scenario.name}-bin`,
  );
  await mkdir(
    root,
    { recursive: true },
  );
  await Promise.all([
    mkdir(home),
    mkdir(nativeBin),
  ]);
  await populate({
    root,
    home,
    scenario,
    scanner: tools.scanner,
  });
  await symlink(
    tools.native,
    join(
      nativeBin,
      'git',
    ),
  );
  const lintPath = tools.lintDirectory === undefined
    ? ''
    : `:${tools.lintDirectory}`;
  const incumbentEnvironment = hermeticEnvironment({
    home,
    path: `/usr/bin:/bin:${tools.nodeDirectory}${lintPath}`,
    extra: {
      FORBIDDEN_STRINGS_RULES: join(
        root,
        RULES_FILE,
      ),
    },
  });
  // The native wrapper reads `rulesFile` alone: no environment variable names the rules file for it.
  const nativeEnvironment = hermeticEnvironment({
    home,
    path: `${nativeBin}:/usr/bin:/bin${lintPath}`,
  });
  const incumbentEntry = join(
    packageDirectory,
    'src/index.ts',
  );
  const fixture = {
    root,
    /**
     Run the incumbent wrapper in this fixture.

     @param {readonly string[]} args - arguments after `git`
     @returns {Promise<import('./differential-config-process.mjs').Observed>} what it decided
     */
    incumbent: function runIncumbent(args) {
      return observe({
        command: process.execPath,
        args: [
          incumbentEntry,
          ...args,
        ],
        cwd: root,
        env: incumbentEnvironment,
      });
    },
    /**
     Run the native wrapper in this fixture.

     @param {readonly string[]} args - arguments after `git`
     @returns {Promise<import('./differential-config-process.mjs').Observed>} what it decided
     */
    native: function runNative(args) {
      return observe({
        command: join(
          nativeBin,
          'git',
        ),
        args,
        cwd: root,
        env: nativeEnvironment,
      });
    },
  };
  const trust = await fixture.incumbent([
    'cli-git',
    'trust',
    '--yes',
  ]);
  if (trust.code !== 0)
    throw new DifferentialError(`The incumbent refused to trust the real configuration: ${trust.stderr}`);
  return fixture;
}

/**
 What a mutating probe left behind: Git's short status, the difference of worktree and index against `HEAD`,
 and the bytes of the scenario's own files (untracked ones appear in no difference).

 @param {{ fixture: Fixture, scenario: import('./differential-config-scenarios.mjs').Scenario }} request - fixture
   and candidates
 @returns {Promise<string>} a text summary comparable between wrappers
 */
export async function leftBehind({
  fixture,
  scenario,
}) {
  const environment = hermeticEnvironment({
    home: fixture.root,
    path: '/usr/bin:/bin',
  });
  const [
    status,
    difference,
    ...contents
  ] = await Promise.all([
    observe({
      command: REAL_GIT,
      args: [
        'status',
        '--porcelain',
      ],
      cwd: fixture.root,
      env: environment,
    }),
    observe({
      command: REAL_GIT,
      args: [
        'diff',
        '--no-ext-diff',
        'HEAD',
      ],
      cwd: fixture.root,
      env: environment,
    }),
    ...Object.keys(scenario.changes)
      .map(function readOwn(path) {
        return readFile(
          join(
            fixture.root,
            path,
          ),
          'utf8',
        );
      }),
  ]);
  return `${status.stdout}\n${difference.stdout}\n${JSON.stringify(contents)}`;
}
