/**
 * Morph API key resolution.
 * Checks environment variable first, then falls back to
 * reading from ~/.pi/agent/mcp.json where Morph MCP servers
 * may store their keys.
 */

import { readFile, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';

/** Path to pi's MCP configuration file. */
const MCP_CONFIG_PATH = join(
  homedir(),
  '.pi',
  'agent',
  'mcp.json',
);

/**
 * Shape of the MCP configuration file.
 * Keys are stored under `mcpServers.<name>.env.MORPH_API_KEY`.
 */
type McpConfig = {
  mcpServers?: Record<
    string,
    {
      env?: Record<string, string>;
    }
  >;
};

/**
 * Cached API key resolved during this session.
 * Avoids re-reading mcp.json on every compaction event.
 */
let cachedApiKey: string | undefined = undefined;

/** Whether the cache has been populated (even if result is undefined). */
let cachePopulated = false;

/**
 * Read `MORPH_API_KEY` from `~/.pi/agent/mcp.json`.
 * Walks all MCP server entries looking for an `env.MORPH_API_KEY` value.
 *
 * @returns the API key found in mcp.json, or undefined
 *
 * @example
 * ```typescript
 * const key = await readKeyFromMcpConfig();
 * // key === "sk-..." or undefined
 * ```
 */
async function readKeyFromMcpConfig(): Promise<string | undefined> {
  try {
    const contents = await readFile(
      MCP_CONFIG_PATH,
      'utf8',
    );
    // eslint-disable-next-line @morph-compact/no-unsafe-type-assertion -- JSON.parse returns any; we validate shape below
    const config: unknown = JSON.parse(contents,);
    if (typeof config !== 'object' || config === null)
      return undefined;
    const servers = (config as McpConfig).mcpServers;
    if (servers === undefined)
      return undefined;

    const serverNames = Object.keys(servers,);
    for (const serverName of serverNames) {
      const server = servers[serverName];
      const key = server?.env?.['MORPH_API_KEY'];
      if (key !== undefined && key !== '')
        return key;
    }
    return undefined;
  }
  catch {
    // File doesn't exist, unreadable, or invalid JSON — not an error
    return undefined;
  }
}

/**
 * Resolve the Morph API key.
 * Checks `MORPH_API_KEY` environment variable first,
 * then falls back to `~/.pi/agent/mcp.json`.
 * Result is cached for the session.
 *
 * @returns the resolved API key, or undefined if not found
 *
 * @example
 * ```typescript
 * const key = await resolveMorphApiKey();
 * if (key !== undefined) {
 *   const client = new MorphCompactClient({ morphApiKey: key });
 * }
 * ```
 */
export async function resolveMorphApiKey(): Promise<string | undefined> {
  // Check env var first
  const envKey = process.env.MORPH_API_KEY;
  if (envKey !== undefined && envKey !== '')
    return envKey;

  // Return cached value if already resolved
  if (cachePopulated)
    return cachedApiKey;

  // Read from mcp.json and cache
  cachedApiKey = await readKeyFromMcpConfig();
  cachePopulated = true;
  return cachedApiKey;
}

/**
 * Reset cached API key.
 * Called on session start to allow re-reading if the config changed.
 *
 * @example
 * ```typescript
 * pi.on("session_start", () => resetApiKeyCache());
 * ```
 */
export function resetApiKeyCache(): void {
  cachedApiKey = undefined;
  cachePopulated = false;
}
