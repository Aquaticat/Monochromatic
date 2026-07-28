/**
 * Tests for the extension entry point.
 *
 * Covers event handler registration, /guard command behavior,
 * and propose_trust tool execution.
 */

import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import type { ExtensionAPI, ToolCallEvent, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import autoMode, {
  buildApprovalFingerprint,
  initializeAutoMode,
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/** Private directory mode required before agent scratch roots are allowlisted. */
const PRIVATE_DIRECTORY_MODE = 0o700;

//region Mock infrastructure

/** Minimal handler signature matching pi event handlers. */
type HandlerFn = (...args: unknown[]) => unknown;

/** Shape of the mock registration map. */
type RegistrationMap = Map<string, HandlerFn[]>;

/** Shape of the mock tool map. */
type ToolMap = Map<string, {
  handler: HandlerFn;
  definition: unknown;
}>;

/** Shape of the mock command map. */
type CommandMap = Map<string, {
  handler: HandlerFn;
  definition: unknown;
}>;

/** Shape of the mock shortcut map. */
type ShortcutMap = Map<string, {
  handler: HandlerFn;
  definition: unknown;
}>;

/** Custom entry appended via pi.appendEntry. */
type AppendedEntry = {
  customType: string;
  data: unknown;
};

/**
 * Creates a mock ExtensionAPI that records all registrations.
 *
 * @returns mock API and tracking structures for assertions
 */
function createMockApi() {
  const registrations: RegistrationMap = new Map();
  const tools: ToolMap = new Map();
  const commands: CommandMap = new Map();
  const shortcuts: ShortcutMap = new Map();
  const entries: AppendedEntry[] = [];

  const api = {
    on(
      event: string,
      handler: HandlerFn,
    ) {
      const existing = registrations.get(event,) ?? [];
      existing.push(handler,);
      registrations.set(event, existing,);
    },
    registerTool(
      definition: Record<string, unknown>,
    ) {
      const name = definition.name as string;
      tools.set(name, {
        handler: definition.execute as HandlerFn,
        definition,
      },);
    },
    registerCommand(
      name: string,
      options: Record<string, unknown>,
    ) {
      commands.set(name, {
        handler: options.handler as HandlerFn,
        definition: options,
      },);
    },
    registerShortcut(
      shortcut: string,
      options: Record<string, unknown>,
    ) {
      shortcuts.set(shortcut, {
        handler: options.handler as HandlerFn,
        definition: options,
      },);
    },
    appendEntry(
      customType: string,
      data: unknown,
    ) {
      entries.push({ customType, data, },);
    },
  } as unknown as ExtensionAPI;

  return {
    api,
    registrations,
    tools,
    commands,
    shortcuts,
    entries,
  };
}

/**
 * Retrieves the registered handler for a given event.
 * Throws if no handler is registered.
 *
 * @returns the handler function
 *
 * @example
 * ```typescript
 * const handler = getHandler({ registrations, event: 'tool_call' });
 * ```
 */
function getHandler(
  {
    registrations,
    event,
  }: {
    registrations: RegistrationMap;
    event: string;
  },
): HandlerFn {
  const handlers = registrations.get(event,);
  if ((handlers === undefined) || (handlers.length === 0))
    throw new Error(`No handler registered for event: ${event}`,);
  const [handler,] = handlers;
  if (handler === undefined)
    throw new Error(`No handler registered for event: ${event}`,);
  return handler;
}

/**
 * Describe read or Bash probe exactly as auto-mode does before approval lookup.
 *
 * @param event - read or Bash tool event used by integration probe
 *
 * @returns action text used by approval fingerprint lookup
 *
 * @throws when event is outside probe's read and Bash surface
 *
 * @example
 * ```typescript
 * probeAction({ type: 'tool_call', toolName: 'read', toolCallId: 'r', input: { path: '/tmp/a' } });
 * ```
 */
function probeAction(
  event: ToolCallEvent,
): string {
  if (event.toolName === 'read') {
    return `read ${(event.input as { readonly path: string; }).path}`;
  }
  if (event.toolName === 'bash') {
    return `bash: ${(event.input as { readonly command: string; }).command}`;
  }
  throw new Error(`Unsupported approval probe tool: ${event.toolName}`,);
}

/**
 * Invoke tool-call handler with prior approval that records only when call was flagged.
 *
 * @param handler - registered auto-mode tool-call handler
 *
 * @param event - tool event whose flagging decision is observed
 *
 * @param cwd - Pi working directory used by path policy and fingerprint
 *
 * @param entries - append-only mock entries inspected before and after handler
 *
 * @returns whether auto-mode reached flagged approval-reuse path
 *
 * @mutates entries - flagged calls append reused approval verdict
 *
 * @example
 * ```typescript
 * await probeFlaggedToolCall({ handler, event, cwd: '/project', entries: [] });
 * ```
 */
async function probeFlaggedToolCall(
  {
    handler,
    event,
    cwd,
    entries,
  }: {
    readonly handler: HandlerFn;
    readonly event: ToolCallEvent;
    readonly cwd: string;
    readonly entries: AppendedEntry[];
  },
): Promise<boolean> {
  /** Entry count before possible approval-reuse audit record. */
  const entryCountBefore = entries.length;
  /** Approval fingerprint matching current event and cwd. */
  const approvalFingerprint = buildApprovalFingerprint({ event, cwd, },);
  await handler(
    event,
    {
      cwd,
      ui: {
        setWidget() {},
      },
      sessionManager: {
        getBranch() {
          return [{
            type: 'custom',
            customType: VERDICT_ENTRY_TYPE,
            data: {
              action: probeAction(event,),
              approvalFingerprint,
              verdict: 'user-approve',
              reason: 'Probe distinguishes flagged path.',
            } satisfies VerdictData,
          },];
        },
      },
    },
  );
  return entries.length > entryCountBefore;
}

//endregion

await describe({
  name: autoMode.name,
  children: [
    //region Registration

    it({
      name: 'registers all seven event handlers',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        await autoMode(api,);

        const expectedEvents = [
          'session_start',
          'session_tree',
          'before_agent_start',
          'agent_start',
          'turn_start',
          'agent_end',
          'tool_call',
        ];

        for (const eventName of expectedEvents) {
          const handlers = registrations.get(eventName,);
          expect(handlers,).toBeDefined();
          expect(handlers,).toHaveLength(1,);
        }
      },
    },),

    //endregion

    //region Skill read allowlist

    it({
      name: 'allows read tool calls inside loaded skill directories',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        await autoMode(api,);

        const beforeAgentStartHandler = getHandler({
          registrations,
          event: 'before_agent_start',
        },);
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        beforeAgentStartHandler({
          type: 'before_agent_start',
          prompt: '',
          systemPrompt: '',
          systemPromptOptions: {
            cwd: '/var/home/user/project',
            skills: [
              {
                name: 'testing-practices',
                description: 'Use when working with tests.',
                filePath:
                  '/var/home/user/Monochromatic/.agents/skills/testing-practices/SKILL.md',
                baseDir: '/var/home/user/Monochromatic/.agents/skills/testing-practices',
              },
            ],
          },
        },);

        const result = await toolCallHandler(
          {
            type: 'tool_call',
            toolName: 'read',
            toolCallId: 'read-skill',
            input: {
              path:
                '/var/home/user/Monochromatic/.agents/skills/testing-practices/SKILL.md',
            },
          },
          {
            cwd: '/var/home/user/project',
          },
        );

        expect(result,).toBeUndefined();
      },
    },),

    it({
      name: 'allows read tool calls inside current account scratch directory',
      fn: async function allowsCurrentAgentTempRead() {
        const home = await mkdtemp(join(
          tmpdir(),
          'amode-index-home-',
        ),);
        const agentRoot = join(
          home,
          'temp',
          'agent',
        );
        await mkdir(
          agentRoot,
          { recursive: true, },
        );
        await chmod(
          agentRoot,
          PRIVATE_DIRECTORY_MODE,
        );
        const tempRoot = await mkdtemp(join(
          agentRoot,
          'auto-mode-index-test-',
        ),);
        const tempFile = join(
          tempRoot,
          'source.ts',
        );
        await writeFile(
          tempFile,
          'export const source = true;\n',
        );

        const { api, registrations, } = createMockApi();
        await initializeAutoMode({
          pi: api,
          home,
          historicalAgentTempDir: join(
            home,
            'historical-agent',
          ),
        },);

        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        const result = await toolCallHandler(
          {
            type: 'tool_call',
            toolName: 'read',
            toolCallId: 'read-agent-temp',
            input: {
              path: tempFile,
            },
          },
          {
            cwd: '/account-project',
          },
        );

        expect(result,).toBeUndefined();
        await rm(
          home,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'allows aliased current-home scratch reads without judge evaluation',
      fn: async function allowsAliasedCurrentHomeScratchRead() {
        /** Disposable parent containing canonical home and lexical home alias. */
        const fixtureRoot = await mkdtemp(join(
          tmpdir(),
          'amode-index-home-alias-',
        ),);
        /** Canonical home target matching systems where `/home` aliases `/var/home`. */
        const canonicalHome = join(
          fixtureRoot,
          'canonical-home',
        );
        /** Lexical home spelling returned by runtime environment. */
        const homeAlias = join(
          fixtureRoot,
          'home-alias',
        );
        /** Canonical private scratch root. */
        const agentRoot = join(
          canonicalHome,
          'temp',
          'agent',
        );
        await mkdir(
          agentRoot,
          { recursive: true, },
        );
        await chmod(
          agentRoot,
          PRIVATE_DIRECTORY_MODE,
        );
        await symlink(
          canonicalHome,
          homeAlias,
          'dir',
        );
        /** Existing file addressed through lexical home alias. */
        const tempFile = join(
          homeAlias,
          'temp',
          'agent',
          'source.ts',
        );
        await writeFile(
          tempFile,
          'export const source = true;\n',
        );

        const {
          api,
          registrations,
          entries,
        } = createMockApi();
        await initializeAutoMode({
          pi: api,
          home: homeAlias,
          historicalAgentTempDir: join(
            fixtureRoot,
            'historical-agent',
          ),
        },);
        /** Registered entry-point handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);
        /** Aliased scratch read matching observed Fedora home spelling. */
        const event = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-aliased-agent-temp',
          input: { path: tempFile, },
        } as ToolCallEvent;

        expect(await probeFlaggedToolCall({
          handler: toolCallHandler,
          event,
          cwd: '/account-project',
          entries,
        },),).toBe(false,);
        await rm(
          fixtureRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'allows statically read-only scratch inspection command families',
      fn: async function allowsReadOnlyScratchInspectionCommands() {
        /** Disposable account home for trusted scratch fixture. */
        const home = await mkdtemp(join(
          tmpdir(),
          'amode-index-read-only-',
        ),);
        /** Private agent scratch root containing candidate repositories. */
        const agentRoot = join(
          home,
          'temp',
          'agent',
        );
        await mkdir(
          agentRoot,
          { recursive: true, },
        );
        await chmod(
          agentRoot,
          PRIVATE_DIRECTORY_MODE,
        );
        /** Candidate repository names matching multi-repository inspection. */
        const repositoryNames = [
          'cidr-tools',
          'ip-address',
          'fast-cidr-tools',
          'ip-kit',
          'ip-num',
        ];
        /** Existing repository roots used by canonical path proof. */
        const repositoryRoots = await Promise.all(repositoryNames.map(
          async function createRepositoryFixture(repositoryName,): Promise<string> {
            /** Repository fixture root. */
            const repositoryRoot = join(
              agentRoot,
              repositoryName,
            );
            await mkdir(
              repositoryRoot,
              { recursive: true, },
            );
            await Promise.all([
              mkdir(
                join(
                  repositoryRoot,
                  '.github',
                  'workflows',
                ),
                { recursive: true, },
              ),
              mkdir(
                join(
                  repositoryRoot,
                  'src',
                ),
                { recursive: true, },
              ),
              mkdir(
                join(
                  repositoryRoot,
                  'test',
                ),
                { recursive: true, },
              ),
              writeFile(
                join(
                  repositoryRoot,
                  'package.json',
                ),
                '{}\n',
              ),
            ],);
            return repositoryRoot;
          },
        ),);
        /** Space-delimited literal repository roots used by shell examples. */
        const repositoryArguments = repositoryRoots.join(' ',);
        /** Exact read-only Bash families from reported approval prompts. */
        const commands = [
          `rg --line-number 'foxts|fast-fnv1a|fnv1a52' ${repositoryRoots[2]}/src ${repositoryRoots[2]}/test ${repositoryRoots[2]}/package.json`,
          `rg --line-number --ignore-case 'wasm|native|prebuild|postinstall|install|node-gyp|binding|generated|fuzz|mutation' ${repositoryArguments} --glob '!pnpm-lock.yaml' --glob '!package-lock.json'`,
          `find ${repositoryArguments} -path '*/.github/workflows/*' -type f -print | sort`,
          `find ${repositoryArguments} -type f \\( -name '*.test.ts' -o -name '*.spec.ts' -o -path '*/test/*' -o -path '*/tests/*' -o -path '*/spec/*' \\) ! -path '*/node_modules/*' -print | sort`,
          `for repo in ${repositoryArguments}; do printf '%s\\t' "$repo"; git -C "$repo" tag --points-at HEAD | paste --serial --delimiters=, -; done`,
        ];
        const {
          api,
          registrations,
          entries,
        } = createMockApi();
        await initializeAutoMode({
          pi: api,
          home,
          historicalAgentTempDir: join(
            home,
            'historical-agent',
          ),
        },);
        /** Registered entry-point handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        /**
         * Concurrent decisions paired with source commands for actionable failure diffs.
         */
        const decisions = await Promise.all(commands.map(
          async function classifyReadOnlyCommand(command, commandIndex,): Promise<{
            readonly command: string;
            readonly flagged: boolean;
          }> {
            /** Bash event carrying one read-only command family. */
            const event = {
              type: 'tool_call',
              toolName: 'bash',
              toolCallId: `bash-read-only-${String(commandIndex,)}`,
              input: { command, },
            } as ToolCallEvent;
            /** Whether read-only command reached approval-reuse path. */
            const flagged = await probeFlaggedToolCall({
              handler: toolCallHandler,
              event,
              cwd: home,
              entries,
            },);
            return { command, flagged, };
          },
        ),);
        for (const { command, flagged, } of decisions)
          expect({ command, flagged, },).toEqual({ command, flagged: false, },);
        await rm(
          home,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'keeps mutating scratch command variants on judge path',
      fn: async function judgesMutatingScratchCommandVariants() {
        /** Disposable account home for trusted scratch fixture. */
        const home = await mkdtemp(join(
          tmpdir(),
          'amode-index-mutating-',
        ),);
        /** Private scratch root containing existing command targets. */
        const agentRoot = join(
          home,
          'temp',
          'agent',
        );
        await mkdir(
          agentRoot,
          { recursive: true, },
        );
        await chmod(
          agentRoot,
          PRIVATE_DIRECTORY_MODE,
        );
        /** Existing target that makes redirect and direct mutation observable to classifier. */
        const targetPath = join(
          agentRoot,
          'target.txt',
        );
        await writeFile(
          targetPath,
          'fixture\n',
        );
        /** Outside root reached only if unquoted scratch glob follows symlink. */
        const outsideRoot = await mkdtemp(join(
          tmpdir(),
          'amode-index-outside-',
        ),);
        await symlink(
          outsideRoot,
          join(
            agentRoot,
            'escape',
          ),
          'dir',
        );
        /** Secret-looking path that must retain secret-path signal inside scratch allowlist. */
        const secretPath = join(
          agentRoot,
          '.env',
        );
        await writeFile(
          secretPath,
          'SECRET=value\n',
        );
        /** Mutating, executable, or expansion-unsafe variants that must not receive read-only bypass. */
        const commands = [
          `touch ${targetPath}`,
          `find ${agentRoot} -type f -delete`,
          `rg --pre cat fixture ${agentRoot}`,
          `git -C ${agentRoot} tag release-candidate`,
          `rg fixture ${agentRoot} > ${targetPath}`,
          `find ${agentRoot} -type f -exec touch {} \\;`,
          `find -L ${agentRoot} -type f -print`,
          `sort --output=${targetPath}`,
          `printf -v result '%s' fixture`,
          `MODE=fixture rg fixture ${agentRoot}`,
          `for repo in ${agentRoot}/{repo,../../outside}; do git -C "$repo" tag --points-at HEAD; done`,
          `for repo in ${agentRoot}; do git -C $repo tag --points-at HEAD; done`,
          `rg fixture ${agentRoot}/*`,
          `rg fixture ${agentRoot}/escape`,
          `rg fixture ${outsideRoot}`,
          `rg fixture ${secretPath}`,
        ];
        const {
          api,
          registrations,
          entries,
        } = createMockApi();
        await initializeAutoMode({
          pi: api,
          home,
          historicalAgentTempDir: join(
            home,
            'historical-agent',
          ),
        },);
        /** Registered entry-point handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        /**
         * Concurrent decisions paired with unsafe commands for actionable failure diffs.
         */
        const decisions = await Promise.all(commands.map(
          async function classifyMutatingCommand(command, commandIndex,): Promise<{
            readonly command: string;
            readonly flagged: boolean;
          }> {
            /** Bash event carrying one unsafe lookalike command. */
            const event = {
              type: 'tool_call',
              toolName: 'bash',
              toolCallId: `bash-mutating-${String(commandIndex,)}`,
              input: { command, },
            } as ToolCallEvent;
            /** Whether unsafe command reached approval-reuse path. */
            const flagged = await probeFlaggedToolCall({
              handler: toolCallHandler,
              event,
              cwd: home,
              entries,
            },);
            return { command, flagged, };
          },
        ),);
        for (const { command, flagged, } of decisions)
          expect({ command, flagged, },).toEqual({ command, flagged: true, },);
        await Promise.all([
          rm(
            home,
            {
              recursive: true,
              force: true,
            },
          ),
          rm(
            outsideRoot,
            {
              recursive: true,
              force: true,
            },
          ),
        ],);
      },
    },),

    it({
      name: 'allows Bash credential handoff through current account scratch root',
      fn: async function allowsCurrentAgentTempBashCredentialHandoff() {
        const home = await mkdtemp(join(
          tmpdir(),
          'amode-index-home-',
        ),);
        const agentRoot = join(
          home,
          'temp',
          'agent',
        );
        await mkdir(
          agentRoot,
          { recursive: true, },
        );
        await chmod(
          agentRoot,
          PRIVATE_DIRECTORY_MODE,
        );
        const projectRoot = await mkdtemp(join(
          tmpdir(),
          'amode-index-project-',
        ),);
        const tempRoot = await mkdtemp(join(
          agentRoot,
          'amode-index-test-',
        ),);
        const envPath = join(
          projectRoot,
          '.env.local',
        );
        const scriptPath = join(
          tempRoot,
          'gemcheck.ts',
        );
        const imageGlob = join(
          tempRoot,
          'page-*.png',
        );
        await writeFile(
          envPath,
          'IMAGE_DIFF_GEMINI_API_KEY=test\n',
        );
        await writeFile(
          scriptPath,
          'export {};\n',
        );

        const { api, registrations, } = createMockApi();
        await initializeAutoMode({
          pi: api,
          home,
          historicalAgentTempDir: join(
            home,
            'historical-agent',
          ),
        },);

        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        const result = await toolCallHandler(
          {
            type: 'tool_call',
            toolName: 'bash',
            toolCallId: 'bash-current-agent-temp-credential',
            input: {
              command:
                `KEY=$(grep --max-count=1 IMAGE_DIFF_GEMINI_API_KEY ${envPath} | cut --delimiter='=' --fields=2- | tr --delete '"'); GEMINI_API_KEY="$KEY" node ${scriptPath} gemini-3.5-flash ${imageGlob}`,
            },
          },
          {
            cwd: projectRoot,
          },
        );

        expect(result,).toBeUndefined();
        await Promise.all([
          rm(
            projectRoot,
            {
              recursive: true,
              force: true,
            },
          ),
          rm(
            home,
            {
              recursive: true,
              force: true,
            },
          ),
        ],);
      },
    },),

    //endregion

    //region Approval reuse

    it({
      name: 'auto approves flagged action with prior session approval',
      fn: async function autoApprovesFlaggedActionWithPriorSessionApproval() {
        const {
          api,
          registrations,
          entries,
        } = createMockApi();
        await autoMode(api,);

        /** Registered tool-call handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);
        /** Repeated read tool event that should match prior session approval. */
        const event = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-env',
          input: {
            path: '/repo/.env',
          },
        } as unknown as ToolCallEvent;
        /** Exact fingerprint for the repeated read tool event. */
        const approvalFingerprint = buildApprovalFingerprint({
          event,
          cwd: '/repo',
        },);
        /** Guard result for repeated action, undefined means allowed by Pi. */
        const result = await toolCallHandler(
          event,
          {
            cwd: '/repo',
            ui: {
              setWidget() {},
            },
            sessionManager: {
              getBranch() {
                return [
                  {
                    type: 'custom',
                    customType: VERDICT_ENTRY_TYPE,
                    data: {
                      action: 'read /repo/.env',
                      approvalFingerprint,
                      verdict: 'user-approve',
                      reason: 'User approved dotenv read.',
                    } satisfies VerdictData,
                  },
                ];
              },
            },
          },
        );

        expect(result,).toBeUndefined();
        expect(entries,).toHaveLength(1,);
        expect(entries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read /repo/.env',
            approvalFingerprint,
            reusedFromVerdict: 'user-approve',
            verdict: 'approve',
            reason: 'User approved dotenv read.',
          },
        },);
      },
    },),

    it({
      name: 'auto approves flagged read with prior range approval',
      fn: async function autoApprovesFlaggedReadWithPriorRangeApproval() {
        const {
          api,
          registrations,
          entries,
        } = createMockApi();
        await autoMode(api,);

        /** Registered tool-call handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);
        /** Previously-approved read tool event for one file range. */
        const approvedEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-env-approved-range',
          input: {
            path: '/repo/.env',
            offset: 1,
            limit: 20,
          },
        } as unknown as ToolCallEvent;
        /** Repeated read tool event for another range in the same file. */
        const repeatedEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-env-repeated-range',
          input: {
            path: '/repo/.env',
            offset: 21,
            limit: 20,
          },
        } as unknown as ToolCallEvent;
        /** Exact fingerprint for the approved read tool event. */
        const approvalFingerprint = buildApprovalFingerprint({
          event: approvedEvent,
          cwd: '/repo',
        },);
        /** Guard result for repeated action, undefined means allowed by Pi. */
        const result = await toolCallHandler(
          repeatedEvent,
          {
            cwd: '/repo',
            ui: {
              setWidget() {},
            },
            sessionManager: {
              getBranch() {
                return [
                  {
                    type: 'custom',
                    customType: VERDICT_ENTRY_TYPE,
                    data: {
                      action: 'read /repo/.env',
                      approvalFingerprint,
                      verdict: 'user-approve',
                      reason: 'User approved dotenv read.',
                    } satisfies VerdictData,
                  },
                ];
              },
            },
          },
        );

        expect(result,).toBeUndefined();
        expect(entries,).toHaveLength(1,);
        expect(entries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read /repo/.env',
            approvalFingerprint,
            reusedFromVerdict: 'user-approve',
            verdict: 'approve',
            reason: 'User approved dotenv read.',
          },
        },);
      },
    },),

    //endregion

    //region /guard command

    it({
      name: 'registers /guard command',
      fn: async () => {
        const { api, commands, } = createMockApi();
        await autoMode(api,);

        expect(commands.has('guard',),).toBe(true,);
      },
    },),

    //endregion

    //region propose_trust tool

    it({
      name: 'registers propose_trust tool',
      fn: async () => {
        const { api, tools, } = createMockApi();
        await autoMode(api,);

        expect(tools.has('propose_trust',),).toBe(true,);
      },
    },),

    //endregion

    //region Entry persistence

    it({
      name: 'appendEntry is called for trust directives',
      fn: async () => {
        const { api, commands, entries, } = createMockApi();
        await autoMode(api,);

        const guardHandler = commands.get('guard',)?.handler;
        if (guardHandler === undefined)
          throw new Error('guard command not registered',);

        // Simulate adding a trust directive
        const mockCtx = {
          ui: { notify: () => {}, },
        };
        await guardHandler('Allow .env access', mockCtx,);

        expect(entries.length,).toBeGreaterThan(0,);
        const trustEntry = entries.find(
          e => e.customType === 'auto-mode:trust',
        );
        expect(trustEntry,).toBeDefined();
        expect(trustEntry?.data,).toBe('Allow .env access',);
      },
    },),

    it({
      name: 'appendEntry resets trust directives with null',
      fn: async () => {
        const { api, commands, entries, } = createMockApi();
        await autoMode(api,);

        const guardHandler = commands.get('guard',)?.handler;
        if (guardHandler === undefined)
          throw new Error('guard command not registered',);

        const mockCtx = {
          ui: { notify: () => {}, },
        };
        await guardHandler('reset', mockCtx,);

        const resetEntry = entries.find(
          e => (e.customType === 'auto-mode:trust') && (e.data === null),
        );
        expect(resetEntry,).toBeDefined();
      },
    },),
    //endregion
  ],
},);
