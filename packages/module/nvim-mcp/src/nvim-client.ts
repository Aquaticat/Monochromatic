import { attach, type NeovimClient } from "neovim";
import { readdirSync, statSync } from "node:fs";
import { connect } from "node:net";

// Severity codes from vim.diagnostic.severity
const SEVERITY_MAP: Record<number, string> = {
  1: "ERROR",
  2: "WARN",
  3: "INFO",
  4: "HINT",
};

export interface Diagnostic {
  severity: string;
  lnum: number;
  col: number;
  end_lnum: number;
  end_col: number;
  message: string;
  source: string | null;
  code: string | number | null;
}

export interface CurrentFile {
  path: string;
  filetype: string;
  modified: boolean;
}

let client: NeovimClient | null = null;

/**
 * Find the Neovim RPC socket path.
 * 1. $NVIM env var (set when running inside :terminal)
 * 2. Scan /run/user/<uid>/nvim.* for the most recently created socket
 */
function findSocketPath(): string {
  if (process.env.NVIM) return process.env.NVIM;

  const uid = process.getuid?.();
  if (uid === undefined) throw new Error("Cannot determine UID for socket scan");

  const dir = `/run/user/${uid}`;
  try {
    const entries = readdirSync(dir).filter((e) => e.startsWith("nvim."));
    if (entries.length === 0) throw new Error("No nvim sockets found");

    // Pick the most recently modified socket
    let best = { name: entries[0]!, mtime: 0 };
    for (const name of entries) {
      const fullPath = `${dir}/${name}`;
      const st = statSync(fullPath);
      if (st.mtimeMs > best.mtime) best = { name, mtime: st.mtimeMs };
    }
    return `${dir}/${best.name}`;
  } catch (err) {
    throw new Error(
      `No Neovim socket found. Set $NVIM or run Droid from Neovim's :terminal. (${err})`,
    );
  }
}

export async function getClient(): Promise<NeovimClient> {
  if (client) return client;

  const socketPath = findSocketPath();
  const socket = connect(socketPath);

  // The neovim package's attach() expects a readable+writable stream pair
  client = attach({ reader: socket, writer: socket });
  return client;
}

export async function getDiagnostics(): Promise<Diagnostic[]> {
  const nvim = await getClient();

  // nvim_exec_lua returns the Lua expression result serialized through msgpack
  const raw = (await nvim.executeLua(
    `
    local buf = vim.api.nvim_get_current_buf()
    local diags = vim.diagnostic.get(buf)
    local result = {}
    for _, d in ipairs(diags) do
      table.insert(result, {
        severity = d.severity,
        lnum = d.lnum,
        col = d.col,
        end_lnum = d.end_lnum,
        end_col = d.end_col,
        message = d.message,
        source = d.source,
        code = d.code,
      })
    end
    return result
    `,
    [],
  )) as Array<Record<string, unknown>>;

  return raw.map((d) => ({
    severity: SEVERITY_MAP[d.severity as number] ?? `UNKNOWN(${d.severity})`,
    lnum: (d.lnum as number) + 1, // convert 0-indexed to 1-indexed for humans
    col: (d.col as number) + 1,
    end_lnum: (d.end_lnum as number) + 1,
    end_col: (d.end_col as number) + 1,
    message: d.message as string,
    source: (d.source as string) ?? null,
    code: (d.code as string | number) ?? null,
  }));
}

export async function getCurrentFile(): Promise<CurrentFile> {
  const nvim = await getClient();

  const result = (await nvim.executeLua(
    `
    local buf = vim.api.nvim_get_current_buf()
    return {
      path = vim.api.nvim_buf_get_name(buf),
      filetype = vim.bo[buf].filetype,
      modified = vim.bo[buf].modified,
    }
    `,
    [],
  )) as Record<string, unknown>;

  return {
    path: result.path as string,
    filetype: result.filetype as string,
    modified: result.modified as boolean,
  };
}
