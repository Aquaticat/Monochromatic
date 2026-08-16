import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { findMiseMonorepoRootCached, } from '@monochromatic-dev/module-fs-path/ts';
import {
  JSON_RPC_UNSUPPORTED_PROTOCOL_VERSION,
  PROTOCOL_VERSION,
} from '@monochromatic-dev/mcp-stdio/ts';
import spawn, { type SubprocessError, } from 'nano-spawn';

/** Mise monorepo root for spawn cwd, so the built bin path is invariant to the task's launch directory. */
const REPO_ROOT = await findMiseMonorepoRootCached();

/** Built bin path, resolved from the monorepo root. */
const BIN_PATH = 'package/mcp/mvm/dist/final/node/index.mjs';

/**
 * Spawns the built bin with stdin closed (EOF) and returns its exit code.
 *
 * @returns Numeric exit code; 0 when the server constructs and the transport loop ends cleanly
 *
 * @example
 * ```ts
 * const code = await runWithClosedStdin();
 * // code === 0
 * ```
 */
async function runWithClosedStdin(): Promise<number> {
  try {
    await spawn('node', [BIN_PATH,], { cwd: REPO_ROOT, stdin: 'ignore', },);
    return 0;
  }
  catch (error: unknown) {
    return (error as SubprocessError).exitCode ?? 1;
  }
}

/**
 * Drives the built bin over stdio with newline-delimited JSON-RPC and returns its replies.
 * Exercises the real artifact across the transport boundary, the way a client reaches it.
 *
 * @param requests - Messages written to the subprocess stdin, in order.
 *
 * @returns Parsed replies read from subprocess stdout.
 *
 * @example
 * ```ts
 * const replies = await exchange({ requests: [{ jsonrpc: '2.0', id: 1, method: 'server/discover' }] });
 * ```
 */
async function exchange(
  { requests, }: { readonly requests: readonly Readonly<Record<string, unknown>>[]; },
): Promise<readonly Record<string, unknown>[]> {
  /**
   * Subprocess output, collected after stdin closes and the transport loop drains.
   */
  const { stdout, } = await spawn(
    'node',
    [BIN_PATH,],
    {
      cwd: REPO_ROOT,
      stdin: {
        string: `${
          requests
            .map(function serializeRequest(request,) {
              return JSON.stringify(request,);
            },)
            .join('\n',)
        }\n`,
      },
    },
  );
  return stdout
    .split('\n',)
    .filter(function isPopulated(line,) {
      return line.trim().length > 0;
    },)
    .map(function parseReply(line,) {
      return JSON.parse(line,) as Record<string, unknown>;
    },);
}

/**
 * Backend name no registered kind answers to.
 *
 * Keeps every destroy_vm case inert: a call that got past argument validation still cannot
 * resolve a backend, so no VM is ever destroyed by this suite.
 */
const UNRESOLVABLE_BACKEND = 'no-such-backend-kind';

/**
 * Request `_meta` declaring the protocol revision the built server implements.
 */
const REQUEST_META = {
  _meta: {
    'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
    'io.modelcontextprotocol/clientCapabilities': {},
  },
};

await describe({
  name: 'mvm-mcp bin (built artifact smoke test)',
  children: [
    //region Clean startup: with stdin at EOF the server constructs, reads zero JSON-RPC lines, and exits 0.
    // No tool call fires, so no KVM VM is ever provisioned (every mvm tool would mutate VM state). This executes
    // the built bin end-to-end (registers all 8 tools, runs the stdio transport loop) without side effects.

    it({
      name: 'constructs the server and exits 0 when stdin is closed',
      fn: async () => {
        /** Numeric exit code from the closed-stdin run. */
        const exitCode = await runWithClosedStdin();
        expect(exitCode,).toBe(0,);
      },
    },),

    //endregion Clean startup

    //region Protocol boundary: drive the built bin the way a client does.
    // Only discovery and listing are exercised; every mvm tool would mutate VM state,
    // so no tools/call fires and no VM is ever provisioned.

    it({
      name: 'answers server/discover with the revision it implements',
      fn: async () => {
        /** Replies to a lone discovery request. */
        const replies = await exchange({
          requests: [{
            jsonrpc: '2.0',
            id: 1,
            method: 'server/discover',
            params: REQUEST_META,
          },],
        },);
        expect(replies,).toHaveLength(1,);
        const result = replies[0]?.result as {
          resultType: string;
          supportedVersions: readonly string[];
          capabilities: unknown;
          instructions: string;
          ttlMs: number;
          cacheScope: string;
        };
        expect(result.resultType,).toBe('complete',);
        expect(result.supportedVersions,).toEqual([PROTOCOL_VERSION,],);
        expect(result.capabilities,).toEqual({ tools: {}, },);
        expect(result.instructions,).toContain('backend',);
        expect((typeof result.ttlMs),).toBe('number',);
        expect(result.cacheScope,).toBe('private',);
      },
    },),

    it({
      name: 'lists every registered tool with a result envelope',
      fn: async () => {
        /** Replies to a lone listing request. */
        const replies = await exchange({
          requests: [{
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: REQUEST_META,
          },],
        },);
        const result = replies[0]?.result as {
          resultType: string;
          tools: readonly { name: string; }[];
        };
        expect(result.resultType,).toBe('complete',);
        expect(
          result.tools.map(function getName(tool,) {
            return tool.name;
          },),
        ).toEqual([
          'list_vms',
          'create_vm',
          'destroy_vm',
          'exec_in_vm',
          'run_in_vm',
          'update_templates',
          'push_to_vm',
          'pull_from_vm',
        ],);
      },
    },),

    it({
      name: 'refuses a request declaring a revision it does not implement',
      fn: async () => {
        /** Replies to a request naming a handshake-era revision. */
        const replies = await exchange({
          requests: [{
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/list',
            params: {
              _meta: {
                'io.modelcontextprotocol/protocolVersion': '2025-06-18',
                'io.modelcontextprotocol/clientCapabilities': {},
              },
            },
          },],
        },);
        const error = replies[0]?.error as {
          code: number;
          data: { supported: readonly string[]; requested: string; };
        };
        expect(error.code,).toBe(JSON_RPC_UNSUPPORTED_PROTOCOL_VERSION,);
        expect(error.data,).toEqual({
          supported: [PROTOCOL_VERSION,],
          requested: '2025-06-18',
        },);
      },
    },),

    //endregion Protocol boundary

    //region destroy_vm argument validation: refuses ambiguous targets before touching a backend.
    // Every case names a backend kind nothing answers to, so even the accepted call cannot
    // reach a real backend and no VM is ever destroyed.

    it({
      name: 'refuses destroy_vm naming a VM alongside all: true instead of destroying every VM',
      fn: async () => {
        /** Reply to a destroy call carrying both targets. */
        const replies = await exchange({
          requests: [{
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
              ...REQUEST_META,
              name: 'destroy_vm',
              arguments: {
                name: 'web-01',
                all: true,
                backend: UNRESOLVABLE_BACKEND,
              },
            },
          },],
        },);
        const result = replies[0]?.result as {
          isError: boolean;
          content: readonly { text: string; }[];
        };
        expect(result.isError,).toBe(true,);
        expect(result.content[0]?.text,).toContain('not both',);
        expect(result.content[0]?.text,).toContain('web-01',);
      },
    },),

    it({
      name: 'refuses destroy_vm carrying neither target',
      fn: async () => {
        /** Reply to a destroy call with no target. */
        const replies = await exchange({
          requests: [{
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: {
              ...REQUEST_META,
              name: 'destroy_vm',
              arguments: { backend: UNRESOLVABLE_BACKEND, },
            },
          },],
        },);
        const result = replies[0]?.result as {
          isError: boolean;
          content: readonly { text: string; }[];
        };
        expect(result.isError,).toBe(true,);
        expect(result.content[0]?.text,).toContain('all: true',);
      },
    },),

    it({
      name: 'reaches backend resolution once destroy_vm carries exactly one target',
      fn: async () => {
        // Positive control for both refusals: the same unresolvable backend now surfaces a
        // backend error, so the refusals really did stop short of resolving a backend.
        /** Reply to a well-formed destroy call whose backend cannot be resolved. */
        const replies = await exchange({
          requests: [{
            jsonrpc: '2.0',
            id: 6,
            method: 'tools/call',
            params: {
              ...REQUEST_META,
              name: 'destroy_vm',
              arguments: {
                name: 'web-01',
                backend: UNRESOLVABLE_BACKEND,
              },
            },
          },],
        },);
        const result = replies[0]?.result as {
          isError: boolean;
          content: readonly { text: string; }[];
        };
        expect(result.isError,).toBe(true,);
        expect(result.content[0]?.text,).toContain(UNRESOLVABLE_BACKEND,);
      },
    },),

    //endregion destroy_vm argument validation
  ],
},);
