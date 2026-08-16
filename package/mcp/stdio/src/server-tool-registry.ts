// Normalizes tool entries into the immutable registry the dispatcher looks tools up in.

import type {
  RegisteredTool,
  ToolEntry,
} from './server-types.ts';

import type { ToolDefinition, } from './protocol-tool.ts';

//region Registration: turns declared entries into wire definitions plus handlers

/**
 * Builds the wire-format definition a client sees in `tools/list` from one declared entry.
 * Optional fields are dropped rather than sent as `undefined`, so the definition matches
 * what a client receives after serialization.
 *
 * @param entry - Declared tool entry, typically produced by {@link defineTool}.
 *
 * @returns Definition carrying only the fields this entry declared.
 *
 * @example
 * ```ts
 * buildToolDefinition({
 *   entry: { name: 'ping', description: 'Returns pong.', handler: () => ({ content: [] }) },
 * });
 * // { name: 'ping', description: 'Returns pong.', inputSchema: { type: 'object' } }
 * ```
 */
function buildToolDefinition(
  { entry, }: { readonly entry: ToolEntry; },
): ToolDefinition {
  return {
    name: entry.name,
    description: entry.description,
    // MCP clients require `inputSchema` on every tool, even one taking no arguments.
    inputSchema: entry.inputSchema ?? { type: 'object', },
    ...((entry.title === undefined) ? {} : { title: entry.title, }),
    ...((entry.outputSchema === undefined) ? {} : { outputSchema: entry.outputSchema, }),
    ...((entry.annotations === undefined) ? {} : { annotations: entry.annotations, }),
  };
}

/**
 * Builds the immutable tool registry consulted on every `tools/list` and `tools/call`.
 * Construction-time only: the map is never reopened, so a served tool set cannot drift
 * from the one a client discovered.
 *
 * @param tools - Tool entries declared when the server was created.
 *
 * @returns Registry keyed by tool name.
 *
 * @example
 * ```ts
 * const registry = registerTools({
 *   tools: [{ name: 'ping', description: 'Returns pong.', handler: () => ({ content: [] }) }],
 * });
 * registry.get('ping')?.definition.name;
 * // 'ping'
 * ```
 */
export function registerTools(
  { tools, }: { readonly tools: readonly ToolEntry[]; },
): ReadonlyMap<string, RegisteredTool> {
  /**
   * Registry built from every declared entry, keyed by the name clients call.
   */
  const registry = new Map(
    tools.map(function buildRegisteredTool(entry,) {
      return [
        entry.name,
        {
          definition: buildToolDefinition({ entry, },),
          handler: entry.handler,
        },
      ] as const;
    },),
  );

  // A duplicate name would silently drop the earlier tool: `tools/list` would advertise one
  // tool per name while `tools/call` dispatched to whichever entry was declared last.
  if (registry.size !== tools.length) {
    throw new Error(
      `Duplicate tool names registered: ${
        tools
          .map(function getName(entry,) {
            return entry.name;
          },)
          .filter(function isDuplicate(name, index, names,) {
            return names.indexOf(name,) !== index;
          },)
          .join(', ',)
      }. Clients address tools by name, so each name must be unique within one server`,
    );
  }

  return registry;
}

//endregion
