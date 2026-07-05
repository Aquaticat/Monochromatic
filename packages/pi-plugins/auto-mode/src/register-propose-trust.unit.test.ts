/**
 * Tests for propose_trust tool registration.
 *
 * @module
 */

import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { registerProposeTrust, } from './register-propose-trust.ts';
import { TRUST_ENTRY_TYPE, } from './types.ts';

/** Trust directive reused across propose_trust tests. */
const TRUST_RULE = 'Allow .env file access';

/** Near-match trust directive that must not satisfy exact active-rule matching. */
const TRUST_RULE_WITH_TRAILING_SPACE = `${TRUST_RULE} `;

/** Tool parameters accepted by registered propose_trust execute handler. */
type ProposeTrustParams = {
  /** Session trust directive requested by agent. */
  readonly rule: string;
  /** Optional rationale for why directive is needed. */
  readonly reason?: string;
};

/** Tool result shape returned by registered propose_trust handler. */
type ProposeTrustResult = AgentToolResult<unknown>;

/** Registered propose_trust execute handler shape used by tests. */
type ProposeTrustExecute = (
  toolCallId: string,
  params: ProposeTrustParams,
  signal: unknown,
  onUpdate: unknown,
  ctx: ExtensionContext,
) => Promise<ProposeTrustResult>;

/** Minimal persisted-entry shape captured by mock extension API. */
type AppendedEntry = {
  /** Entry custom type passed to {@link ExtensionAPI.appendEntry}. */
  readonly customType: string;
  /** Entry payload passed to {@link ExtensionAPI.appendEntry}. */
  readonly data: unknown;
};

/** Minimal session branch entry shape consumed by getTrustDirectives. */
type MockBranchEntry = {
  /** Session entry discriminator. */
  readonly type: string;
  /** Extension custom entry discriminator. */
  readonly customType?: string;
  /** Optional custom entry payload. */
  readonly data?: unknown;
};

/** UI selection prompt captured by mock context. */
type SelectionCall = {
  /** Prompt title/body passed to UI select. */
  readonly title: string;
  /** Button labels passed to UI select. */
  readonly options: readonly string[];
};

/** Test-controlled select implementation. */
type SelectHandler = (
  params: {
    /** Prompt title/body passed to UI select. */
    readonly title: string;
    /** Button labels passed to UI select. */
    readonly options: readonly string[];
  },
) => Promise<string>;

/** Map from tool name to registered execute handler. */
type ToolMap = Map<string, ProposeTrustExecute>;

/**
 * Create mock extension API recording registered tools and appended entries.
 *
 * @param tools - map receiving registered tool execute handlers
 *
 * @param entries - array receiving appended session entries
 *
 * @param branch - optional mock session branch receiving real custom entries
 *
 * @returns mock extension API
 *
 * @example
 * ```typescript
 * const api = createMockApi({ tools: new Map(), entries: [] });
 * ```
 */
function createMockApi(
  {
    tools,
    entries,
    branch,
  }: {
    readonly tools: ToolMap;
    readonly entries: AppendedEntry[];
    readonly branch?: MockBranchEntry[];
  },
): ExtensionAPI {
  return {
    registerTool(
      definition: {
        readonly name: string;
        readonly execute: ProposeTrustExecute;
      },
    ): void {
      tools.set(
        definition.name,
        definition.execute,
      );
    },
    appendEntry(
      customType: string,
      data: unknown,
    ): void {
      entries.push({
        customType,
        data,
      },);
      branch?.push({
        type: 'custom',
        customType,
        data,
      },);
    },
  } as unknown as ExtensionAPI;
}

/**
 * Create mock extension context with branch history and optional UI behavior.
 *
 * @param branch - session branch returned by mock session manager
 *
 * @param hasUI - whether context reports interactive UI availability
 *
 * @param select - test-controlled UI selection behavior
 *
 * @param selectionCalls - array receiving UI prompts
 *
 * @returns mock extension context
 *
 * @example
 * ```typescript
 * const ctx = createContext({ branch: [trustEntry({ rule: TRUST_RULE })] });
 * ```
 */
function createContext(
  {
    branch,
    hasUI = true,
    select = rejectUnexpectedSelection,
    selectionCalls = [],
  }: {
    readonly branch: readonly MockBranchEntry[];
    readonly hasUI?: boolean;
    readonly select?: SelectHandler;
    readonly selectionCalls?: SelectionCall[];
  },
): ExtensionContext {
  return {
    cwd: '/repo',
    hasUI,
    ui: {
      select(
        title: string,
        options: string[],
      ): Promise<string> {
        selectionCalls.push({
          title,
          options,
        },);
        return select({
          title,
          options,
        },);
      },
    },
    sessionManager: {
      getBranch() {
        return branch;
      },
    },
  } as unknown as ExtensionContext;
}

/**
 * Build trust-directive branch entry.
 *
 * @param rule - active trust directive text
 *
 * @returns mock trust-directive entry
 *
 * @example
 * ```typescript
 * trustEntry({ rule: TRUST_RULE });
 * ```
 */
function trustEntry(
  {
    rule,
  }: {
    readonly rule: string;
  },
): MockBranchEntry {
  return {
    type: 'custom',
    customType: TRUST_ENTRY_TYPE,
    data: rule,
  };
}

/**
 * Build reset branch entry clearing prior trust directives.
 *
 * @returns mock trust reset entry
 *
 * @example
 * ```typescript
 * trustResetEntry();
 * ```
 */
function trustResetEntry(): MockBranchEntry {
  return {
    type: 'custom',
    customType: TRUST_ENTRY_TYPE,
    data: null,
  };
}

/**
 * Retrieve registered propose_trust execute handler.
 *
 * @param tools - map containing registered tool handlers
 *
 * @returns propose_trust execute handler
 *
 * @throws when propose_trust was not registered
 *
 * @example
 * ```typescript
 * const execute = getProposeTrustExecute({ tools });
 * ```
 */
function getProposeTrustExecute(
  {
    tools,
  }: {
    readonly tools: ToolMap;
  },
): ProposeTrustExecute {
  const execute = tools.get('propose_trust',);
  if (execute === undefined)
    throw new Error('propose_trust tool was not registered.',);
  return execute;
}

/**
 * Extract text from single-text tool result.
 *
 * @param result - propose_trust execution result
 *
 * @returns text content from first result item
 *
 * @throws when result content is missing or non-text
 *
 * @example
 * ```typescript
 * const text = resultText(result);
 * ```
 */
function resultText(
  result: ProposeTrustResult,
): string {
  const [firstContent,] = result.content;
  if (firstContent === undefined)
    throw new Error('Expected tool result content.',);
  if (firstContent.type !== 'text')
    throw new Error('Expected text tool result content.',);
  return firstContent.text;
}

/**
 * Selection handler that fails when auto-approval should skip UI.
 *
 * @returns never, because prompt is unexpected
 *
 * @throws whenever called
 *
 * @example
 * ```typescript
 * await rejectUnexpectedSelection();
 * ```
 */
async function rejectUnexpectedSelection(): Promise<string> {
  throw new Error('propose_trust unexpectedly prompted for selection.',);
}

/**
 * Selection handler accepting trust proposal.
 *
 * @returns accept choice
 *
 * @example
 * ```typescript
 * await acceptSelection();
 * ```
 */
async function acceptSelection(): Promise<string> {
  return 'Accept';
}

/**
 * Selection handler rejecting trust proposal.
 *
 * @returns reject choice
 *
 * @example
 * ```typescript
 * await rejectSelection();
 * ```
 */
async function rejectSelection(): Promise<string> {
  return 'Reject';
}

/**
 * Register propose_trust and return execute handler plus recorded entries.
 *
 * @param branch - optional mock session branch receiving real custom entries
 *
 * @returns registered handler and mutable entry log
 *
 * @example
 * ```typescript
 * const { execute } = registerForTest();
 * ```
 */
function registerForTest(
  {
    branch,
  }: {
    readonly branch?: MockBranchEntry[];
  } = {},
): {
  readonly execute: ProposeTrustExecute;
  readonly entries: AppendedEntry[];
} {
  const tools: ToolMap = new Map();
  const entries: AppendedEntry[] = [];
  registerProposeTrust(createMockApi({
    tools,
    entries,
    ...(branch !== undefined ? { branch, } : {}),
  },),);
  return {
    entries,
    execute: getProposeTrustExecute({ tools, },),
  };
}

await describe({
  name: registerProposeTrust.name,
  children: [
    it({
      name: 'auto-approves active trust rule without UI',
      fn: async function autoApprovesActiveTrustRuleWithoutUi(): Promise<void> {
        const { execute, entries, } = registerForTest();

        const result = await execute(
          'trust-call',
          { rule: TRUST_RULE, },
          undefined,
          undefined,
          createContext({
            branch: [trustEntry({ rule: TRUST_RULE, },),],
            hasUI: false,
          },),
        );

        expect(resultText(result,),).toContain(
          `Trust rule already trusted for this session: "${TRUST_RULE}".`,
        );
        expect(entries,).toHaveLength(0,);
      },
    },),
    it({
      name: 'auto-approves trust rule re-added after reset',
      fn: async function autoApprovesTrustRuleReAddedAfterReset(): Promise<void> {
        const { execute, entries, } = registerForTest();

        const result = await execute(
          'trust-call',
          { rule: TRUST_RULE, },
          undefined,
          undefined,
          createContext({
            branch: [
              trustEntry({ rule: TRUST_RULE, },),
              trustResetEntry(),
              trustEntry({ rule: TRUST_RULE, },),
            ],
            hasUI: false,
          },),
        );

        expect(resultText(result,),).toContain(
          `Trust rule already trusted for this session: "${TRUST_RULE}".`,
        );
        expect(entries,).toHaveLength(0,);
      },
    },),
    it({
      name: 'rejects new trust rule without UI',
      fn: async function rejectsNewTrustRuleWithoutUi(): Promise<void> {
        const { execute, entries, } = registerForTest();

        const result = await execute(
          'trust-call',
          { rule: TRUST_RULE, },
          undefined,
          undefined,
          createContext({
            branch: [],
            hasUI: false,
          },),
        );

        expect(resultText(result,),).toBe('Rejected: no interactive UI available.',);
        expect(entries,).toHaveLength(0,);
      },
    },),
    it({
      name: 'prompts for active trust rule near-match',
      fn: async function promptsForActiveTrustRuleNearMatch(): Promise<void> {
        const { execute, entries, } = registerForTest();
        const selectionCalls: SelectionCall[] = [];

        const result = await execute(
          'trust-call',
          { rule: TRUST_RULE_WITH_TRAILING_SPACE, },
          undefined,
          undefined,
          createContext({
            branch: [trustEntry({ rule: TRUST_RULE, },),],
            select: rejectSelection,
            selectionCalls,
          },),
        );

        expect(selectionCalls,).toHaveLength(1,);
        expect(resultText(result,),).toBe(
          'Trust rule rejected by user. Try a different approach, or ask the user to run the command directly.',
        );
        expect(entries,).toHaveLength(0,);
      },
    },),
    it({
      name: 'prompts for new trust rule and appends on accept',
      fn: async function promptsForNewTrustRuleAndAppendsOnAccept(): Promise<void> {
        const { execute, entries, } = registerForTest();
        const selectionCalls: SelectionCall[] = [];

        const result = await execute(
          'trust-call',
          {
            reason: 'Needed for package setup.',
            rule: TRUST_RULE,
          },
          undefined,
          undefined,
          createContext({
            branch: [],
            select: acceptSelection,
            selectionCalls,
          },),
        );

        expect(selectionCalls,).toHaveLength(1,);
        expect(selectionCalls[0]?.title,).toContain(TRUST_RULE,);
        expect(selectionCalls[0]?.title,).toContain('Needed for package setup.',);
        expect(resultText(result,),).toContain(
          `Trust rule accepted for this session: "${TRUST_RULE}".`,
        );
        expect(entries,).toEqual([
          {
            customType: TRUST_ENTRY_TYPE,
            data: TRUST_RULE,
          },
        ],);
      },
    },),
    it({
      name: 'reuses accepted trust rule from session branch',
      fn: async function reusesAcceptedTrustRuleFromSessionBranch(): Promise<void> {
        const branch: MockBranchEntry[] = [];
        const { execute, entries, } = registerForTest({ branch, },);

        await execute(
          'trust-call',
          { rule: TRUST_RULE, },
          undefined,
          undefined,
          createContext({
            branch,
            select: acceptSelection,
          },),
        );

        const result = await execute(
          'trust-call-repeat',
          { rule: TRUST_RULE, },
          undefined,
          undefined,
          createContext({
            branch,
            hasUI: false,
          },),
        );

        expect(resultText(result,),).toContain(
          `Trust rule already trusted for this session: "${TRUST_RULE}".`,
        );
        expect(entries,).toHaveLength(1,);
      },
    },),
    it({
      name: 'does not auto-approve trust rule cleared by reset',
      fn: async function doesNotAutoApproveTrustRuleClearedByReset(): Promise<void> {
        const { execute, entries, } = registerForTest();
        const selectionCalls: SelectionCall[] = [];

        const result = await execute(
          'trust-call',
          { rule: TRUST_RULE, },
          undefined,
          undefined,
          createContext({
            branch: [
              trustEntry({ rule: TRUST_RULE, },),
              trustResetEntry(),
            ],
            select: rejectSelection,
            selectionCalls,
          },),
        );

        expect(selectionCalls,).toHaveLength(1,);
        expect(resultText(result,),).toBe(
          'Trust rule rejected by user. Try a different approach, or ask the user to run the command directly.',
        );
        expect(entries,).toHaveLength(0,);
      },
    },),
  ],
},);
