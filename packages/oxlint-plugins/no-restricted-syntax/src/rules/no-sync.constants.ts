import type { Variable, } from '@oxlint/plugins';

//region Classification sentinels

/**
 * Sentinel returned when an expression is not a banned Node sync API call.
 *
 * @example
 * ```ts
 * const result = NOT_NODE_SYNC_CALLEE;
 * if (typeof result === 'symbol') return;
 * ```
 */
export const NOT_NODE_SYNC_CALLEE: unique symbol = Symbol(
  'callee is not node synchronous api',
);

/**
 * Result of classifying a callee expression.
 */
export type NodeSyncCalleeName = string | typeof NOT_NODE_SYNC_CALLEE;

/**
 * Sentinel returned when a source string is not statically available.
 *
 * @example
 * ```ts
 * const source = NO_STATIC_SOURCE;
 * if (typeof source === 'symbol') return false;
 * ```
 */
export const NO_STATIC_SOURCE: unique symbol = Symbol(
  'module source is not statically known',
);

/**
 * Result of extracting a module source string from syntax.
 */
export type StaticSource = string | typeof NO_STATIC_SOURCE;

/**
 * Sentinel returned when scope lookup finds no local variable.
 *
 * @example
 * ```ts
 * const variable = NO_VARIABLE;
 * if (typeof variable === 'symbol') return false;
 * ```
 */
export const NO_VARIABLE: unique symbol = Symbol(
  'scope has no matching variable binding',
);

/**
 * Result of looking up an identifier in the current scope chain.
 */
export type VariableLookup = Variable | typeof NO_VARIABLE;

//endregion Classification sentinels

//region Node module constants

/**
 * Suffix used by Node's synchronous twin APIs.
 */
export const SYNC_SUFFIX = 'Sync';

/**
 * Node builtin module roots accepted with or without the `node:` prefix.
 */
const NODE_BUILTIN_MODULE_ROOTS = [
  '_http_agent',
  '_http_client',
  '_http_common',
  '_http_incoming',
  '_http_outgoing',
  '_http_server',
  '_stream_duplex',
  '_stream_passthrough',
  '_stream_readable',
  '_stream_transform',
  '_stream_wrap',
  '_stream_writable',
  '_tls_common',
  '_tls_wrap',
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'test',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
] as const;

/**
 * Set form of {@link NODE_BUILTIN_MODULE_ROOTS} for constant-time membership.
 */
const NODE_BUILTIN_MODULE_ROOT_SET: ReadonlySet<string> = new Set(
  NODE_BUILTIN_MODULE_ROOTS,
);

/**
 * Returns `true` when a module source names a Node builtin module.
 *
 * Accepts both `fs` and `node:fs`, and treats subpaths such as
 * `fs/promises` as belonging to the builtin root.
 *
 * @param source - Literal module source from import, require, or getBuiltinModule.
 *
 * @returns Whether source names a Node builtin module root.
 *
 * @example
 * ```ts
 * isNodeBuiltinSource({ source: 'node:fs' }); // true
 * isNodeBuiltinSource({ source: '@optique/core/parser' }); // false
 * ```
 */
export function isNodeBuiltinSource(
  { source, }: { readonly source: string; },
): boolean {
  /**
   * Module source without optional `node:` scheme.
   */
  const sourceWithoutProtocol = source.startsWith('node:',)
    ? source.slice('node:'.length,)
    : source;
  /**
   * Slash position separating builtin root from optional subpath.
   */
  const slashIndex = sourceWithoutProtocol.indexOf('/',);
  /**
   * Node builtin root candidate.
   */
  const root = slashIndex === (-1)
    ? sourceWithoutProtocol
    : sourceWithoutProtocol.slice(
      0,
      slashIndex,
    );
  return NODE_BUILTIN_MODULE_ROOT_SET.has(root,);
}

//endregion Node module constants
