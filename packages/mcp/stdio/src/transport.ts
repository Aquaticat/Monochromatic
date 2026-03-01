// Stdio transport: reads JSON-RPC from stdin, dispatches through McpServer, writes responses to stdout.

import { readLines } from './line-reader.ts';

import { JSON_RPC_PARSE_ERROR } from './types.ts';

import type { McpServer } from './server.ts';
import type { JsonRpcInbound, JsonRpcOutbound } from './types.ts';

//region Output writer abstraction -- supports both Bun FileSink and standard WritableStream

/**
 * Minimal writer interface that both Bun's `FileSink` and `WritableStreamDefaultWriter` satisfy.
 * Allows the transport to work with `Bun.stdout.writer()` without depending on the full `WritableStreamDefaultWriter` shape.
 *
 * @example
 * ```ts
 * const writer: StdoutWriter = Bun.stdout.writer();
 * await writer.write(new TextEncoder().encode('hello\n'));
 * ```
 */
export type StdoutWriter = {
  write(data: Uint8Array): number | Promise<number>;
};

//endregion

/**
 * Connects an {@link McpServer} to stdin/stdout using newline-delimited JSON-RPC.
 * Reads lines from stdin, parses each as a JSON-RPC message, dispatches to the server,
 * and writes responses as newline-terminated JSON to stdout.
 *
 * This function runs until stdin closes (the client terminates the subprocess).
 *
 * @param server - MCP server instance with registered tools.
 * @param input - Readable byte stream for incoming messages. Defaults to `Bun.stdin.stream()`.
 * @param output - Writer for outgoing messages. Defaults to `Bun.stdout.writer()`.
 *
 * @example
 * ```ts
 * import { McpServer, serve } from '@monochromatic-dev/mcp-stdio';
 *
 * const server = new McpServer({ name: 'demo', version: '0.1.0' });
 * await serve(server);
 * ```
 */
export async function serve(
  server: McpServer,
  input: ReadableStream<Uint8Array> = Bun.stdin.stream(),
  output: StdoutWriter = Bun.stdout.writer(),
): Promise<void> {
  const encoder = new TextEncoder();

  for await (const line of readLines(input)) {
    if (line.trim().length === 0) {
      continue;
    }

    // `parsed` needs reassignment from undefined to the parsed value inside try/catch.
    let parsed: JsonRpcInbound | undefined;
    try {
      parsed = JSON.parse(line) as JsonRpcInbound;
    } catch {
      const errorResponse: JsonRpcOutbound = {
        jsonrpc: '2.0',
        id: 0,
        error: { code: JSON_RPC_PARSE_ERROR, message: 'Failed to parse JSON' },
      };
      await writeMessage(output, encoder, errorResponse);
      continue;
    }

    console.error(`[mcp-stdio] <- ${line}`);

    const response = await server.handleMessage(parsed);

    // Notifications produce no response.
    if (response === undefined) {
      continue;
    }

    console.error(`[mcp-stdio] -> ${JSON.stringify(response)}`);
    await writeMessage(output, encoder, response);
  }
}

/**
 * Writes a JSON-RPC message as a newline-terminated UTF-8 string to the output stream.
 *
 * @param writer - Writer for stdout output.
 * @param encoder - Reusable TextEncoder instance.
 * @param message - JSON-RPC response to serialize and write.
 */
async function writeMessage(
  writer: StdoutWriter,
  encoder: TextEncoder,
  message: JsonRpcOutbound,
): Promise<void> {
  const serialized = JSON.stringify(message) + '\n';
  await writer.write(encoder.encode(serialized));
}
