/**
 * Tests for linked git worktree read allowlisting.
 *
 * Exercises disposable real git repositories so auto-mode reads can cross from
 * main worktree to linked worktree without weakening write guards.
 */

import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import type {
  ExtensionAPI,
  ToolCallEvent,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';

import autoMode from './index.ts';
import {
  linkedWorktreeReadAllowlistedDirs,
  resolveRealGit,
} from './git-worktree-read-allowlist.ts';
import { shouldFlag, } from './signals.ts';
import type { SignalContext, } from './types.ts';

//region Git fixture helpers

/** Absolute path to real git binary used for disposable fixture setup. */
const realGitPath = await resolveRealGit();

/** Git author email used in disposable repositories. */
const TEST_USER_EMAIL = 'pi-auto-mode@example.invalid';

/** Git author name used in disposable repositories. */
const TEST_USER_NAME = 'pi auto-mode test';

/** Options for running real git commands in tests. */
type RunGitOptions = {
  /** Working directory for subprocess. */
  readonly cwd: string;
  /** Arguments passed after executable name. */
  readonly args: readonly string[];
};

/** Disposable temporary directory used by worktree tests. */
type TempDirectory = {
  /** Absolute path to temporary directory. */
  readonly path: string;
  /** Deletes temporary directory after test exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/** Disposable repository fixture with one linked worktree and a source file. */
type WorktreeFixture = {
  /** Main worktree root. */
  readonly repoPath: string;
  /** Linked worktree root. */
  readonly linkedPath: string;
  /** Non-secret file inside linked worktree. */
  readonly linkedFile: string;
};

/** Minimal handler signature used by the mock ExtensionAPI. */
type HandlerFn = (first: unknown, second: unknown) => unknown;

/** Shape of the mock registration map. */
type RegistrationMap = Map<string, HandlerFn[]>;

/**
 * Creates disposable temporary directory for real git fixtures.
 *
 * @returns Temporary directory that removes itself after test exits.
 *
 * @example
 * ```ts
 * await using tempDirectory = await createTempDirectory();
 * ```
 */
async function createTempDirectory(): Promise<TempDirectory> {
  /** Absolute temporary directory path for one test case. */
  const path = await mkdtemp(join(
    tmpdir(),
    'auto-mode-linked-worktree-',
  ),);

  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Runs real git binary for fixture setup.
 *
 * @param cwd - Working directory for subprocess.
 *
 * @param args - Git arguments after executable name.
 *
 * @returns Nothing after git command succeeds.
 *
 * @example
 * ```ts
 * await runRealGit({ cwd: '/repo', args: ['init', '--quiet'] });
 * ```
 */
async function runRealGit({
  cwd,
  args,
}: RunGitOptions,): Promise<void> {
  await nanoSpawn(
    realGitPath,
    [...args,],
    {
      cwd,
      stdin: 'ignore',
    },
  );
}

/**
 * Initializes disposable real git repository.
 *
 * @param repoPath - Repository path to create and initialize.
 *
 * @returns Nothing after repository is initialized.
 *
 * @example
 * ```ts
 * await initializeRepository({ repoPath: '/tmp/repo' });
 * ```
 */
async function initializeRepository({
  repoPath,
}: {
  /** Repository root to create. */
  readonly repoPath: string;
},): Promise<void> {
  await mkdir(
    repoPath,
    { recursive: true, },
  );
  await runRealGit({
    cwd: repoPath,
    args: [
      'init',
      '--quiet',
    ],
  },);
  await runRealGit({
    cwd: repoPath,
    args: [
      'config',
      'user.email',
      TEST_USER_EMAIL,
    ],
  },);
  await runRealGit({
    cwd: repoPath,
    args: [
      'config',
      'user.name',
      TEST_USER_NAME,
    ],
  },);
}

/**
 * Creates initial empty commit in repository.
 *
 * @param repoPath - Repository path to seed.
 *
 * @returns Nothing after initial commit exists.
 *
 * @example
 * ```ts
 * await createInitialCommit({ repoPath: '/tmp/repo' });
 * ```
 */
async function createInitialCommit({
  repoPath,
}: {
  /** Repository root to seed. */
  readonly repoPath: string;
},): Promise<void> {
  await runRealGit({
    cwd: repoPath,
    args: [
      'commit',
      '--allow-empty',
      '--quiet',
      '--message',
      'initial',
    ],
  },);
}

/**
 * Creates detached linked worktree for repository HEAD.
 *
 * @param repoPath - Main worktree root.
 *
 * @param linkedPath - Linked worktree root to create.
 *
 * @returns Nothing after linked worktree exists.
 *
 * @example
 * ```ts
 * await createLinkedWorktree({ repoPath: '/repo', linkedPath: '/linked' });
 * ```
 */
async function createLinkedWorktree({
  repoPath,
  linkedPath,
}: {
  /** Main worktree root. */
  readonly repoPath: string;
  /** Linked worktree root. */
  readonly linkedPath: string;
},): Promise<void> {
  await runRealGit({
    cwd: repoPath,
    args: [
      'worktree',
      'add',
      '--detach',
      linkedPath,
      'HEAD',
    ],
  },);
}

/**
 * Creates repository fixture with one linked worktree and one readable file.
 *
 * @param tempPath - Parent temporary directory.
 *
 * @returns Main root, linked root, and linked source file path.
 *
 * @example
 * ```ts
 * const fixture = await createWorktreeFixture({ tempPath: '/tmp/case' });
 * ```
 */
async function createWorktreeFixture({
  tempPath,
}: {
  /** Parent temporary directory. */
  readonly tempPath: string;
},): Promise<WorktreeFixture> {
  /** Main worktree root for this fixture. */
  const repoPath = join(
    tempPath,
    'main',
  );
  /** Linked worktree root for this fixture. */
  const linkedPath = join(
    tempPath,
    'linked',
  );
  /** Non-secret file inside linked worktree. */
  const linkedFile = join(
    linkedPath,
    'source.ts',
  );

  await initializeRepository({ repoPath, },);
  await createInitialCommit({ repoPath, },);
  await createLinkedWorktree({
    repoPath,
    linkedPath,
  },);
  await writeFile(
    linkedFile,
    'export const source = true;\n',
  );

  return {
    repoPath,
    linkedPath,
    linkedFile,
  };
}

//endregion Git fixture helpers

//region Mock ExtensionAPI helpers

/**
 * Creates minimal mock ExtensionAPI that records event registrations.
 *
 * @returns Mock API and registration map.
 *
 * @example
 * ```ts
 * const { api, registrations } = createMockApi();
 * ```
 */
function createMockApi(): {
  readonly api: ExtensionAPI;
  readonly registrations: RegistrationMap;
} {
  /** Event handlers registered by auto-mode. */
  const registrations: RegistrationMap = new Map();

  /** Minimal ExtensionAPI implementation for exercising tool-call handler. */
  const api = {
    on(
      event: string,
      handler: HandlerFn,
    ): void {
      /** Existing handlers for this event. */
      const existingHandlers = registrations.get(event,) ?? [];
      existingHandlers.push(handler,);
      registrations.set(
        event,
        existingHandlers,
      );
    },
    registerTool(_definition: unknown,): void {},
    registerCommand(
      _name: string,
      _options: unknown,
    ): void {},
    registerShortcut(
      _shortcut: string,
      _options: unknown,
    ): void {},
    appendEntry(
      _customType: string,
      _data: unknown,
    ): void {},
  } as unknown as ExtensionAPI;

  return {
    api,
    registrations,
  };
}

/**
 * Retrieves registered handler for a given event.
 *
 * @param registrations - Mock registration map.
 *
 * @param event - Event name to look up.
 *
 * @returns Registered handler.
 *
 * @throws When event was not registered.
 *
 * @example
 * ```ts
 * const handler = getHandler({ registrations, event: 'tool_call' });
 * ```
 */
function getHandler({
  registrations,
  event,
}: {
  /** Mock registration map. */
  readonly registrations: RegistrationMap;
  /** Event name to look up. */
  readonly event: string;
},): HandlerFn {
  /** Handlers registered for requested event. */
  const handlers = registrations.get(event,);
  if ((handlers === undefined) || (handlers.length === 0))
    throw new Error(`No handler registered for event: ${event}`,);
  /** First registered handler for requested event. */
  const [handler,] = handlers;
  if (handler === undefined)
    throw new Error(`No handler registered for event: ${event}`,);
  return handler;
}

//endregion Mock ExtensionAPI helpers

await describe({
  name: linkedWorktreeReadAllowlistedDirs.name,
  children: [
    it({
      name: 'returns linked worktree roots and excludes main root',
      fn: async function returnsLinkedRootsAndExcludesMainRoot() {
        await using tempDirectory = await createTempDirectory();
        /** Disposable repository with one linked worktree. */
        const fixture = await createWorktreeFixture({ tempPath: tempDirectory.path, },);
        /** Auto-mode read allowlist computed from main worktree root. */
        const readAllowlistedDirs = await linkedWorktreeReadAllowlistedDirs({
          cwd: fixture.repoPath,
        },);

        expect(readAllowlistedDirs,).toContain(fixture.linkedPath,);
        expect(readAllowlistedDirs.includes(fixture.repoPath,),).toBe(false,);
      },
    },),

    it({
      name: 'returns empty allowlist outside git worktrees',
      fn: async function returnsEmptyOutsideGitWorktrees() {
        await using tempDirectory = await createTempDirectory();

        expect(await linkedWorktreeReadAllowlistedDirs({ cwd: tempDirectory.path, },),)
          .toEqual([],);
      },
    },),

    it({
      name: 'allows reads while keeping writes and secret paths guarded',
      fn: async function allowsReadsWhileKeepingWritesAndSecretPathsGuarded() {
        await using tempDirectory = await createTempDirectory();
        /** Disposable repository with one linked worktree. */
        const fixture = await createWorktreeFixture({ tempPath: tempDirectory.path, },);
        /** Signal context rooted at main worktree. */
        const ctx: SignalContext = {
          cwd: fixture.repoPath,
          home: tempDirectory.path,
        };
        /** Linked worktree roots passed into read-only allowlist. */
        const readAllowlistedDirs = await linkedWorktreeReadAllowlistedDirs({
          cwd: fixture.repoPath,
        },);
        /** Secret-looking file inside linked worktree. */
        const linkedSecretFile = join(
          fixture.linkedPath,
          '.env',
        );
        await writeFile(
          linkedSecretFile,
          'VALUE=example\n',
        );
        /** Read tool call targeting existing non-secret file in linked worktree. */
        const readEvent: ToolCallEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-linked-worktree',
          input: {
            path: fixture.linkedFile,
          },
        };
        /** Write tool call targeting same linked worktree file. */
        const writeEvent: ToolCallEvent = {
          type: 'tool_call',
          toolName: 'write',
          toolCallId: 'write-linked-worktree',
          input: {
            path: fixture.linkedFile,
            content: 'changed',
          },
        };
        /** Read tool call targeting secret-looking file in linked worktree. */
        const secretReadEvent: ToolCallEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-linked-worktree-secret',
          input: {
            path: linkedSecretFile,
          },
        };

        expect(await shouldFlag({
          event: readEvent,
          ctx,
          readAllowlistedDirs,
        },),)
          .toBe(false,);
        expect(await shouldFlag({
          event: writeEvent,
          ctx,
          readAllowlistedDirs,
        },),)
          .toBe(true,);
        expect(await shouldFlag({
          event: secretReadEvent,
          ctx,
          readAllowlistedDirs,
        },),)
          .toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: autoMode.name,
  children: [
    it({
      name: 'wires linked worktree roots into read allowlist',
      fn: async function wiresLinkedWorktreeRootsIntoReadAllowlist() {
        await using tempDirectory = await createTempDirectory();
        /** Disposable repository with one linked worktree. */
        const fixture = await createWorktreeFixture({ tempPath: tempDirectory.path, },);
        /** Mock extension API and event registrations. */
        const { api, registrations, } = createMockApi();
        await autoMode(api,);
        /** Registered tool-call handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);
        /** Handler result for read into linked worktree. */
        const result = await toolCallHandler(
          {
            type: 'tool_call',
            toolName: 'read',
            toolCallId: 'read-linked-worktree-through-index',
            input: {
              path: fixture.linkedFile,
            },
          },
          {
            cwd: fixture.repoPath,
          },
        );

        expect(result,).toBeUndefined();
      },
    },),
  ],
},);
