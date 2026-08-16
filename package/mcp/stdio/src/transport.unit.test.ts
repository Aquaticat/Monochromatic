import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type DispatchResult,
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_REQUEST,
  JSON_RPC_PARSE_ERROR,
  type JsonRpcOutbound,
  type McpServerHandle,
  NO_RESPONSE,
  serve,
  type StdoutWriter,
} from '@monochromatic-dev/mcp-stdio';

//region helpers: test doubles for stdin/stdout and server handle

/**
 * Creates a ReadableStream from newline-delimited messages.
 *
 * @param messages - Raw strings to send as stdin lines (newline appended automatically).
 * @returns ReadableStream simulating stdin.
 */
function stdinFromMessages(messages: readonly string[],): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const content = messages.map(message => `${message}\n`).join('',);
  return new ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>,) {
      controller.enqueue(encoder.encode(content,),);
      controller.close();
    },
  },);
}

/**
 * Creates a StdoutWriter that collects all written output into a string array.
 *
 * @returns Object with writer and collected output lines.
 */
function collectingWriter(): { writer: StdoutWriter; lines: string[]; } {
  const decoder = new TextDecoder();
  const lines: string[] = [];
  const writer: StdoutWriter = {
    write(data: Uint8Array,): number {
      const text = decoder.decode(data,);
      // Split on newlines and filter trailing empty string from final newline.
      const parts = text.split('\n',).filter((part, index, array,) =>
        (index < (array.length - 1)) || (part.length > 0)
      );
      lines.push(...parts,);
      return data.length;
    },
  };
  return { writer, lines, };
}

/**
 * Creates a mock MCP server handle that returns a fixed response for any request.
 *
 * @param response - Dispatch result to return for all requests; `NO_RESPONSE` for notifications.
 * @returns McpServerHandle that always returns the given response.
 */
function mockServer(response: DispatchResult,): McpServerHandle {
  return {
    handleMessage: () => response,
  };
}

//endregion helpers

//region serve; stdio transport connecting stdin/stdout to server handle

await describe({
  name: serve.name,
  children: [
    it({
      name: 'parses valid JSON-RPC message and writes response',
      fn: async () => {
        const serverResponse: JsonRpcOutbound = { jsonrpc: '2.0', id: 1,
          result: { tools: [], }, };
        const server = mockServer(serverResponse,);
        const input = stdinFromMessages([
          '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
        ],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toEqual([JSON.stringify(serverResponse,),],);
      },
    },),
    it({
      name: 'skips blank lines without sending them to server',
      fn: async () => {
        const serverResponse: JsonRpcOutbound = { jsonrpc: '2.0', id: 1, result: {}, };
        const server = mockServer(serverResponse,);
        const input = stdinFromMessages(['', '  ',
          '{"jsonrpc":"2.0","id":1,"method":"server/discover"}',],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toHaveLength(1,);
      },
    },),
    it({
      name: 'returns parse error for invalid JSON',
      fn: async () => {
        const server = mockServer(NO_RESPONSE,);
        const input = stdinFromMessages(['not-json',],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toHaveLength(1,);
        const parsed = JSON.parse(lines[0] ?? '{}',) as JsonRpcOutbound;
        expect((parsed as { error: { code: number; }; }).error.code,).toBe(
          JSON_RPC_PARSE_ERROR,
        );
      },
    },),
    it({
      name: 'returns invalid request for valid JSON that is not a JSON-RPC message',
      fn: async () => {
        const server = mockServer(NO_RESPONSE,);
        const input = stdinFromMessages(['{"not":"jsonrpc"}',],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toHaveLength(1,);
        const parsed = JSON.parse(lines[0] ?? '{}',) as JsonRpcOutbound;
        expect((parsed as { error: { code: number; }; }).error.code,).toBe(
          JSON_RPC_INVALID_REQUEST,
        );
      },
    },),
    it({
      name: 'returns invalid request for a message whose id is null',
      fn: async () => {
        const server = mockServer(NO_RESPONSE,);
        const input = stdinFromMessages([
          '{"jsonrpc":"2.0","id":null,"method":"tools/list"}',
        ],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toHaveLength(1,);
        const parsed = JSON.parse(lines[0] ?? '{}',) as JsonRpcOutbound;
        expect((parsed as { error: { code: number; }; }).error.code,).toBe(
          JSON_RPC_INVALID_REQUEST,
        );
      },
    },),
    it({
      name: 'returns an internal error frame when a result cannot be serialized',
      fn: async () => {
        /** Result carrying a `bigint`, which `JSON.stringify` refuses to encode. */
        const server: McpServerHandle = {
          handleMessage: () => ({
            jsonrpc: '2.0' as const,
            id: 1,
            result: { size: 1n, } as unknown,
          }),
        };
        const input = stdinFromMessages([
          '{"jsonrpc":"2.0","id":1,"method":"server/discover"}',
        ],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toHaveLength(1,);
        const parsed = JSON.parse(lines[0] ?? '{}',) as JsonRpcOutbound;
        expect((parsed as { error: { code: number; }; }).error.code,).toBe(
          JSON_RPC_INTERNAL_ERROR,
        );
        expect((parsed as { id: unknown; }).id,).toBe(1,);
      },
    },),
    it({
      name: 'does not write response for notifications',
      fn: async () => {
        const server = mockServer(NO_RESPONSE,);
        const input = stdinFromMessages([
          '{"jsonrpc":"2.0","method":"notifications/initialized"}',
        ],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toHaveLength(0,);
      },
    },),
    it({
      name: 'handles multiple messages in sequence',
      fn: async () => {
        /** Counter to give each response a unique id. */
        let callCount = 0;
        const server: McpServerHandle = {
          handleMessage: () => {
            callCount += 1;
            return { jsonrpc: '2.0' as const, id: callCount, result: {}, };
          },
        };
        const input = stdinFromMessages([
          '{"jsonrpc":"2.0","id":1,"method":"server/discover"}',
          '{"jsonrpc":"2.0","id":2,"method":"server/discover"}',
          '{"jsonrpc":"2.0","id":3,"method":"server/discover"}',
        ],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        expect(lines,).toHaveLength(3,);
      },
    },),
    it({
      name: 'continues processing after encountering invalid JSON',
      fn: async () => {
        const serverResponse: JsonRpcOutbound = { jsonrpc: '2.0', id: 1, result: {}, };
        const server = mockServer(serverResponse,);
        const input = stdinFromMessages([
          'bad-json',
          '{"jsonrpc":"2.0","id":1,"method":"server/discover"}',
        ],);
        const { writer, lines, } = collectingWriter();

        await serve({ server, input, output: writer, },);

        // One parse error response + one valid response.
        expect(lines,).toHaveLength(2,);
      },
    },),
  ],
},);

//endregion serve
