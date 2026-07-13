// Stdio transport: reads JSON-RPC from stdin, dispatches through server handle, writes responses to stdout.

import {
  isJsonRpcMessage,
  JSON_RPC_PARSE_ERROR,
  type JsonRpcOutbound,
} from './json-rpc.ts';
import { readLines, } from './line-reader.ts';

import {
  type McpServerHandle,
  NO_RESPONSE,
} from './server-types.ts';

//region Output writer abstraction: supports both Bun FileSink and standard WritableStream

/**
 * Minimal writer interface for stdout output.
 * Accepts any object with a `write(Uint8Array)` method, including
 * `Bun.stdout.writer()`, `WritableStreamDefaultWriter`, and the
 * {@link processStdoutWriter} helper.
 *
 * @example
 * ```ts
 * const writer: StdoutWriter = processStdoutWriter();
 * await writer.write(new TextEncoder().encode('hello\n'));
 * ```
 */
export type StdoutWriter = {
  readonly write: (data: Uint8Array,) => number | Promise<number>;
};

/**
 * Creates a {@link StdoutWriter} backed by `process.stdout.write`.
 * Cross-runtime alternative to `Bun.stdout.writer()` that works in Node, Bun, and Deno.
 *
 * @returns Writer that delegates to `process.stdout.write`.
 *
 * @example
 * ```ts
 * const writer = processStdoutWriter();
 * await writer.write(new TextEncoder().encode('hello\n'));
 * ```
 */
function processStdoutWriter(): StdoutWriter {
  return {
    write(data: Uint8Array,): number {
      process.stdout
        .write(data,);
      return data.byteLength;
    },
  };
}

//endregion

//region Stdio message loop: reads stdin lines, validates, dispatches, writes responses

/**
 * Connects an MCP server handle to stdin/stdout using newline-delimited JSON-RPC.
 * Reads lines from stdin via {@link readLines}, parses and validates each as a JSON-RPC
 * message via {@link isJsonRpcMessage}, dispatches to the server, and writes responses
 * as newline-terminated JSON to stdout via {@link writeSerializedMessage}.
 *
 * Runs until stdin closes (the client terminates the subprocess).
 *
 * @param server - Immutable server handle created by {@link createMcpServer}.
 *
 * @param input - Async iterable of byte chunks for incoming messages. Defaults to `process.stdin`.
 *
 * @param output - Writer for outgoing messages. Defaults to a `process.stdout.write` wrapper.
 *
 * @mutates output - writeSerializedMessage delegates each response to output.write, which changes output stream state.
 *
 * @example
 * ```ts
 * import { createMcpServer, defineTool, serve } from '\@monochromatic-dev/mcp-stdio';
 *
 * const server = createMcpServer({ config: { name: 'demo', version: '0.1.0' }, tools: [] });
 * await serve({ server });
 * ```
 */
export async function serve(
  {
    server,
    input = process.stdin,
    output = processStdoutWriter(),
  }: {
    readonly server: McpServerHandle;
    readonly input?: AsyncIterable<Uint8Array>;
    readonly output?: StdoutWriter;
  },
): Promise<void> {
  /**
   * Reused across every outbound message so each call avoids allocating a fresh encoder.
   */
  const encoder = new TextEncoder();

  for await (const line of readLines(input,)) {
    if (line.trim()
      .length
      === 0)
      continue;

    /**
     * Holds the parsed JSON value, or stays `undefined` if `JSON.parse` threw.
     *
     * Declared with `let` because the assignment happens inside the try block; the catch
     * branch needs a binding visible at this scope to write the parse-error response.
     */
    let parsed: unknown = undefined;
    try {
      parsed = JSON.parse(line,);
    }
    catch (error: unknown) {
      console.error(
        '[mcp-stdio] failed to parse JSON from stdin:',
        error,
      );
      /**
       * Parse-error response returned with `id: null` because the original id cannot be recovered.
       */
      const errorResponse: JsonRpcOutbound = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSON_RPC_PARSE_ERROR,
          message: 'Failed to parse JSON',
        },
      };
      await writeSerializedMessage({
        writer: output,
        encoder,
        serialized: JSON.stringify(errorResponse,),
      },);
      continue;
    }

    // Validate step: ensure the parsed value is a valid JSON-RPC 2.0 message
    // before dispatching. Catches non-object values, missing jsonrpc field, etc.
    if (!isJsonRpcMessage(parsed,)) {
      console.error(
        '[mcp-stdio] received invalid JSON-RPC message (missing jsonrpc or method):',
        parsed,
      );
      /**
       * Shape-error response when the message parsed but lacks `jsonrpc` or `method`.
       */
      const errorResponse: JsonRpcOutbound = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSON_RPC_PARSE_ERROR,
          message: 'Invalid JSON-RPC message: missing jsonrpc or method field',
        },
      };
      await writeSerializedMessage({
        writer: output,
        encoder,
        serialized: JSON.stringify(errorResponse,),
      },);
      continue;
    }

    console.error(`[mcp-stdio] <- ${line}`,);

    /**
     * Dispatch result; `NO_RESPONSE` indicates a notification (no reply expected).
     */
    const response = await server.handleMessage(parsed,);

    // Notifications produce no response.
    if (response === NO_RESPONSE)
      continue;

    /**
     * Serialized response reused for diagnostic output and wire write.
     */
    const serializedResponse = JSON.stringify(response,);
    console.error(`[mcp-stdio] -> ${serializedResponse}`,);
    await writeSerializedMessage({
      writer: output,
      encoder,
      serialized: serializedResponse,
    },);
  }
}

//endregion

//region Message serialization: writes JSON-RPC responses to stdout

/**
 * Writes serialized JSON-RPC text as newline-terminated UTF-8 to output stream.
 *
 * @param writer - Writer for stdout output.
 *
 * @param encoder - Reusable TextEncoder instance.
 *
 * @param serialized - JSON-RPC response already serialized where value ownership is known.
 *
 * @mutates writer - writer.write changes output stream state.
 *
 * @example
 * ```ts
 * await writeSerializedMessage({
 *   writer: processStdoutWriter(),
 *   encoder: new TextEncoder(),
 *   serialized: '{"jsonrpc":"2.0","id":1,"result":{}}',
 * });
 * ```
 */
async function writeSerializedMessage(
  {
    writer,
    encoder,
    serialized,
  }: {
    readonly writer: StdoutWriter;
    readonly encoder: Pick<TextEncoder, 'encode'>;
    readonly serialized: string;
  },
): Promise<void> {
  /**
   * Newline-terminated JSON; MCP stdio framing requires one message per line.
   */
  const framed = `${serialized}\n`;
  await writer.write(encoder.encode(framed,),);
}

//endregion
