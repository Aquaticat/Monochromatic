// Convenience helper for declaring named tool entries.

import type { ToolEntry, } from './server-types.ts';

//region defineTool: convenience for declaring tool entries

/**
 * Declares a named tool entry for passing to {@link createMcpServer}.
 * Pure convenience: validates nothing, just bundles name with options.
 *
 * @param name - Unique tool identifier exposed to clients.
 *
 * @param entry - Tool metadata and handler, without the `name` field.
 *
 * @returns Complete tool entry ready for server creation.
 *
 * @example
 * ```ts
 * const tool = defineTool({
 *   name: 'get_time',
 *   entry: {
 *     description: 'Returns current UTC time.',
 *     schema: v.strictObject({}),
 *     handler: async () => ({
 *       content: [{ type: 'text', text: new Date().toISOString() }],
 *     }),
 *   },
 * });
 * ```
 */
export function defineTool(
  {
    name,
    entry,
  }: {
    readonly name: string;
    readonly entry: Omit<ToolEntry, 'name'>;
  },
): ToolEntry {
  return {
    name,
    ...entry,
  };
}

//endregion
