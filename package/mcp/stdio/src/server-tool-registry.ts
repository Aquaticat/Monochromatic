// Normalizes tool entries into the immutable registry the dispatcher looks tools up in.

import type {
  RegisteredTool,
  ToolEntry,
} from './server-types.ts';

import type { ToolDefinition, } from './protocol-tool.ts';
import { toolInputSchema, } from './tool-schema.ts';

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
 *   entry: {
 *     name: 'ping',
 *     description: 'Returns pong.',
 *     schema: v.strictObject({}),
 *     handler: () => ({ content: [] }),
 *   },
 * });
 * // inputSchema is derived from the schema, never authored alongside it
 * ```
 */
function buildToolDefinition(
  { entry, }: { readonly entry: ToolEntry; },
): ToolDefinition {
  return {
    name: entry.name,
    description: entry.description,
    // Derived from the same schema that gates the call, so what is advertised and what is
    // enforced cannot disagree. MCP requires `inputSchema` on every tool, including one
    // taking no arguments, whose schema converts to an empty object.
    inputSchema: toolInputSchema({
      schema: entry.schema,
      toolName: entry.name,
    },),
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
 *   tools: [{
 *     name: 'ping',
 *     description: 'Returns pong.',
 *     schema: v.strictObject({}),
 *     handler: () => ({ content: [] }),
 *   }],
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
          schema: entry.schema,
        },
      ] as const;
    },),
  );

  // A duplicate name would silently drop the earlier tool: `tools/list` would advertise one
  // tool per name while `tools/call` dispatched to whichever entry was declared last.
  if (registry.size !== tools.length) {
    /**
     * Names seen while scanning, so a second sighting identifies the collision to report.
     */
    const seen = new Set<string>();
    /**
     * Names declared more than once, in declaration order.
     */
    const duplicates = tools
      .filter(function isRepeatedName(entry,) {
        /**
         * Whether this name already appeared earlier in the declaration list.
         */
        const repeated = seen.has(entry.name,);
        seen.add(entry.name,);
        return repeated;
      },)
      .map(function getName(entry,) {
        return entry.name;
      },);
    throw new Error(
      `Duplicate tool names registered: ${duplicates.join(', ',)}. `
        + `Clients address tools by name, so each name must be unique within one server`,
    );
  }

  return registry;
}

//endregion
