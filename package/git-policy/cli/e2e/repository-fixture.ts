/**
 Fresh dummy repositories for one scenario:
 a local bare remote,
 a repository with an upstream,
 optionally a linked worktree,
 hooks,
 and SSH signing.
 Nothing here touches host repositories;
 every path lives under the scenario root inside the container.

 @module
 */

import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import {
  configHookArguments,
  type HookEvent,
  installHookdirHooks,
  installPrograms,
} from './hook-program-fixture.ts';
import { runChecked, } from './process-fixture.ts';

//region Types

/**
 How the scenario's repository is set up.
 */
export type RepositoryOptions = Readonly<{
  /**
   Whether commands run in the main worktree or a linked worktree.
   */
  worktree: 'linked' | 'main';
  /**
   Hook source:
   the hooks directory,
   config-based hooks (Git 2.54.0 or newer),
   or none.
   */
  hooks: 'config' | 'hookdir' | 'none';
  /**
   Installed hook events.
   */
  hookEvents: readonly HookEvent[];
  /**
   Extra hook behavior.
   */
  hookMode?: 'lint-staged';
  /**
   Whether every commit is SSH-signed.
   */
  signing: boolean;
  /**
   Files committed and pushed before the scenario starts.
   */
  seedFiles: readonly Readonly<{ path: string; bytes: Buffer; }>[];
}>;

/**
 Ready scenario repository.
 */
export type ScenarioRepository = Readonly<{
  /**
   Scenario root directory.
   */
  root: string;
  /**
   Directory every scenario command runs in.
   */
  worktree: string;
  /**
   Git common directory.
   */
  commonDir: string;
  /**
   Local bare remote.
   */
  remote: string;
  /**
   Branch checked out in `worktree`.
   */
  branch: string;
  /**
   Absolute real Git executable.
   */
  realGit: string;
  /**
   Hook marker directory.
   */
  markerDir: string;
  /**
   Hook log directory.
   */
  logDir: string;
  /**
   Holding editor program.
   */
  editorProgram: string;
  /**
   Environment whose PATH puts the packed wrapper first.
   */
  wrapperEnv: NodeJS.ProcessEnv;
  /**
   Environment without the wrapper on PATH,
   for processes that bypass cli-git.
   */
  realEnv: NodeJS.ProcessEnv;
  /**
   Options the repository was built with.
   */
  options: RepositoryOptions;
}>;

//endregion Types

//region Constants

/**
 Packed wrapper bin directory baked into the image.
 */
export const WRAPPER_BIN = '/opt/cli-git/node_modules/.bin';

/**
 System directories after the selected Git.
 */
const SYSTEM_PATH = '/usr/local/bin:/usr/bin:/bin';

/**
 Committer identity used by every scenario repository.
 */
const IDENTITY = { name: 'e2e', email: 'e2e@example.invalid', } as const;

//endregion Constants

//region Real Git

/**
 Runs real Git by absolute path in a scenario repository;
 fails on non-zero exit.

 @param repository - scenario repository

 @param args - Git arguments

 @param cwd - directory override

 @returns standard output

 @example
 ```ts
 await realGit({ repository, args: ['rev-parse', 'HEAD'] });
 ```
 */
export async function realGit({
  repository,
  args,
  cwd,
}: Readonly<{
  repository: Pick<ScenarioRepository, 'realEnv' | 'realGit' | 'worktree'>;
  args: readonly string[];
  cwd?: string;
}>,): Promise<string> {
  return await runChecked({
    command: repository.realGit,
    args,
    cwd: cwd ?? repository.worktree,
    env: repository.realEnv,
  },);
}

/**
 Writes repository config keys one at a time,
 because each `git config` write takes `config.lock`.

 @param repository - repository to configure

 @param entries - key and value pairs

 @example
 ```ts
 await configure({ repository, entries: [['user.name', 'e2e']] });
 ```
 */
async function configure({
  repository,
  entries,
}: Readonly<{
  repository: Pick<ScenarioRepository, 'realEnv' | 'realGit' | 'worktree'>;
  entries: readonly (readonly [string, string])[];
}>,): Promise<void> {
  for (const [key, value,] of entries) {
    // oxlint-disable-next-line no-await-in-loop -- Concurrent config writes would contend on config.lock.
    await realGit({ repository, args: ['config', key, value,], },);
  }
}

//endregion Real Git

//region Creation

/**
 Configures SSH signing with a fresh key.

 @param repository - repository before scenario start

 @example
 ```ts
 await configureSigning(repository);
 ```
 */
async function configureSigning(repository: ScenarioRepository,): Promise<void> {
  /**
   Private key path; the public key sits beside it.
   */
  const key = join(repository.root, 'signing-key',);
  await runChecked({
    command: 'ssh-keygen',
    args: ['-q', '-t', 'ed25519', '-N', '', '-C', IDENTITY.email, '-f', key,],
    cwd: repository.root,
    env: repository.realEnv,
  },);
  /**
   Allowed-signers file so `git verify-commit` can check signatures.
   */
  const allowed = join(repository.root, 'allowed-signers',);
  await writeFile(allowed, `${IDENTITY.email} ${(await readFile(`${key}.pub`, 'utf8',)).trim()}\n`,);
  await configure({
    repository,
    entries: [
      ['gpg.format', 'ssh',],
      ['user.signingKey', `${key}.pub`,],
      ['commit.gpgSign', 'true',],
      ['gpg.ssh.allowedSignersFile', allowed,],
    ],
  },);
}

/**
 Creates the scenario repository.

 @param root - empty scenario root

 @param gitVersion - Git version under `/opt/git`

 @param options - setup options

 @returns ready repository

 @example
 ```ts
 await createScenarioRepository({ root: '/work/2.55.0/baseline', gitVersion: '2.55.0', options });
 ```
 */
export async function createScenarioRepository({
  root,
  gitVersion,
  options,
}: Readonly<{
  root: string;
  gitVersion: string;
  options: RepositoryOptions;
}>,): Promise<ScenarioRepository> {
  /**
   Directory holding the selected Git.
   */
  const gitBin = `/opt/git/${gitVersion}/bin`;
  /**
   Scenario directories.
   */
  const directories = {
    home: join(root, 'home',),
    markers: join(root, 'markers',),
    logs: join(root, 'logs',),
    tools: join(root, 'tools',),
    main: join(root, 'repo',),
    remote: join(root, 'remote.git',),
  };
  await Promise.all(Object.values(directories,).map(async function create(directory,) {
    await mkdir(directory, { recursive: true, },);
  },),);
  /**
   Environment shared by wrapper and real Git runs.
   */
  const baseEnv: NodeJS.ProcessEnv = {
    HOME: directories.home,
    XDG_CONFIG_HOME: join(directories.home, '.config',),
    GIT_CONFIG_NOSYSTEM: '1',
    LANG: 'C',
    LC_ALL: 'C',
    E2E_MARKER_DIR: directories.markers,
    E2E_LOG_DIR: directories.logs,
    E2E_REAL_GIT: join(gitBin, 'git',),
    ...(options.hookMode === undefined ? {} : { E2E_HOOK_MODE: options.hookMode, }),
  };
  /**
   Real-Git-only environment.
   */
  const realEnv: NodeJS.ProcessEnv = { ...baseEnv, PATH: `${gitBin}:${SYSTEM_PATH}`, };
  /**
   Bootstrap handle before the worktree is final.
   */
  const bootstrap = { realGit: join(gitBin, 'git',), realEnv, worktree: directories.main, };
  await realGit({ repository: bootstrap, args: ['init', '--quiet', '--bare', directories.remote,], cwd: root, },);
  await realGit({ repository: bootstrap, args: ['init', '--quiet', '--initial-branch=main', directories.main,], cwd: root, },);
  await configure({
    repository: bootstrap,
    entries: [
      ['user.name', IDENTITY.name,],
      ['user.email', IDENTITY.email,],
      ['core.autocrlf', 'false',],
    ],
  },);
  await realGit({ repository: bootstrap, args: ['remote', 'add', 'origin', directories.remote,], },);
  await Promise.all(options.seedFiles.map(async function seed(file,) {
    await mkdir(dirname(join(directories.main, file.path,),), { recursive: true, },);
    await writeFile(join(directories.main, file.path,), file.bytes,);
  },),);
  await realGit({ repository: bootstrap, args: ['add', '--', ...options.seedFiles.map(function seedPath(file,) {
    return file.path;
  },),], },);
  await realGit({ repository: bootstrap, args: ['commit', '--quiet', '--message', 'e2e seed',], },);
  await realGit({ repository: bootstrap, args: ['push', '--quiet', '--set-upstream', 'origin', 'main',], },);
  /**
   Linked worktree path when requested.
   */
  const worktree = options.worktree === 'linked' ? join(root, 'linked',) : directories.main;
  if (options.worktree === 'linked') {
    await realGit({ repository: bootstrap, args: ['worktree', 'add', '--quiet', '-b', 'work', worktree,], },);
    await realGit({ repository: { ...bootstrap, worktree, }, args: ['push', '--quiet', '--set-upstream', 'origin', 'work',], },);
  }
  /**
   Installed programs.
   */
  const programs = await installPrograms(directories.tools,);
  /**
   Finished repository handle.
   */
  const repository: ScenarioRepository = {
    root,
    worktree,
    commonDir: join(directories.main, '.git',),
    remote: directories.remote,
    branch: options.worktree === 'linked' ? 'work' : 'main',
    realGit: join(gitBin, 'git',),
    markerDir: directories.markers,
    logDir: directories.logs,
    editorProgram: programs.editor,
    wrapperEnv: { ...baseEnv, PATH: `${WRAPPER_BIN}:${gitBin}:${SYSTEM_PATH}`, },
    realEnv,
    options,
  };
  if (options.signing)
    await configureSigning(repository,);
  if (options.hooks === 'hookdir') {
    await installHookdirHooks({
      hooksDir: join(repository.commonDir, 'hooks',),
      hookProgram: programs.hook,
      events: options.hookEvents,
    },);
  }
  if (options.hooks === 'config') {
    // Sequential: each `git config` write takes config.lock.
    for (const args of configHookArguments({ hookProgram: programs.hook, events: options.hookEvents, },)) {
      // oxlint-disable-next-line no-await-in-loop -- Concurrent config writes would contend on config.lock.
      await realGit({ repository, args, },);
    }
  }
  return repository;
}

//endregion Creation
