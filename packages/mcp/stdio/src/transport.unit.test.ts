import {
  describe,
  expect,
  test,
} from 'bun:test';

import { JSON_RPC_PARSE_ERROR, type JsonRpcOutbound } from './json-rpc.ts';
import { serve, type StdoutWriter } from './transport.ts';

import type { McpServerHandle } from './server-types.ts';

//region helpers -- test doubles for stdin/stdout and server handle

/**
 * Creates a ReadableStream from newline-delimited messages.
 *
 * @param messages - Raw strings to send as stdin lines (newline appended automatically).
 * @returns ReadableStream simulating stdin.
 */
function stdinFromMessages(messages: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const content = messages.map((message) => `${message}\n`).join('');
  return new ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      controller.enqueue(encoder.encode(content));
      controller.close();
    },
  });
}

/**
 * Creates a StdoutWriter that collects all written output into a string array.
 *
 * @returns Object with writer and collected output lines.
 */
function collectingWriter(): { writer: StdoutWriter; lines: string[] } {
  const decoder = new TextDecoder();
  const lines: string[] = [];
  const writer: StdoutWriter = {
    write(data: Uint8Array): number {
      const text = decoder.decode(data);
      // Split on newlines and filter trailing empty string from final newline.
      const parts = text.split('\n').filter((part, index, array) =>
        index < array.length - 1 || part.length > 0,
      );
      lines.push(...parts);
      return data.length;
    },
  };
  return { writer, lines };
}

/**
 * Creates a mock MCP server handle that returns a fixed response for any request.
 *
 * @param response - Response to return for all requests. `undefined` for notifications.
 * @returns McpServerHandle that always returns the given response.
 */
function mockServer(response: JsonRpcOutbound | undefined): McpServerHandle {
  return {
    handleMessage: async () => response,
  };
}

//endregion helpers

//region serve -- stdio transport connecting stdin/stdout to server handle

describe('serve', () => {
  test('parses valid JSON-RPC message and writes response', async () => {
    expect.assertions(1);
    const serverResponse: JsonRpcOutbound = { jsonrpc: '2.0', id: 1, result: { tools: [] } };
    const server = mockServer(serverResponse);
    const input = stdinFromMessages(['{"jsonrpc":"2.0","id":1,"method":"tools/list"}']);
    const { writer, lines } = collectingWriter();

    await serve(server, input, writer);

    expect(lines).toEqual([JSON.stringify(serverResponse)]);
  });

  test('skips blank lines without sending them to server', async () => {
    expect.assertions(1);
    const serverResponse: JsonRpcOutbound = { jsonrpc: '2.0', id: 1, result: {} };
    const server = mockServer(serverResponse);
    const input = stdinFromMessages(['', '  ', '{"jsonrpc":"2.0","id":1,"method":"ping"}']);
    const { writer, lines } = collectingWriter();

    await serve(server, input, writer);

    expect(lines).toHaveLength(1);
  });

  test('returns parse error for invalid JSON', async () => {
    expect.assertions(2);
    const server = mockServer(undefined);
    const input = stdinFromMessages(['not-json']);
    const { writer, lines } = collectingWriter();

    await serve(server, input, writer);

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? '{}') as JsonRpcOutbound;
    expect((parsed as { error: { code: number } }).error.code).toBe(JSON_RPC_PARSE_ERROR);
  });

  test('returns parse error for valid JSON that is not a JSON-RPC message', async () => {
    expect.assertions(2);
    const server = mockServer(undefined);
    const input = stdinFromMessages(['{"not":"jsonrpc"}']);
    const { writer, lines } = collectingWriter();

    await serve(server, input, writer);

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? '{}') as JsonRpcOutbound;
    expect((parsed as { error: { code: number } }).error.code).toBe(JSON_RPC_PARSE_ERROR);
  });

  test('does not write response for notifications', async () => {
    expect.assertions(1);
    const server = mockServer(undefined);
    const input = stdinFromMessages(['{"jsonrpc":"2.0","method":"notifications/initialized"}']);
    const { writer, lines } = collectingWriter();

    await serve(server, input, writer);

    expect(lines).toHaveLength(0);
  });

  test('handles multiple messages in sequence', async () => {
    expect.assertions(1);
    /** Counter to give each response a unique id. */
    let callCount = 0;
    const server: McpServerHandle = {
      handleMessage: async () => {
        callCount += 1;
        return { jsonrpc: '2.0' as const, id: callCount, result: {} };
      },
    };
    const input = stdinFromMessages([
      '{"jsonrpc":"2.0","id":1,"method":"ping"}',
      '{"jsonrpc":"2.0","id":2,"method":"ping"}',
      '{"jsonrpc":"2.0","id":3,"method":"ping"}',
    ]);
    const { writer, lines } = collectingWriter();

    await serve(server, input, writer);

    expect(lines).toHaveLength(3);
  });

  test('continues processing after encountering invalid JSON', async () => {
    expect.assertions(1);
    const serverResponse: JsonRpcOutbound = { jsonrpc: '2.0', id: 1, result: {} };
    const server = mockServer(serverResponse);
    const input = stdinFromMessages([
      'bad-json',
      '{"jsonrpc":"2.0","id":1,"method":"ping"}',
    ]);
    const { writer, lines } = collectingWriter();

    await serve(server, input, writer);

    // One parse error response + one valid response.
    expect(lines).toHaveLength(2);
  });
});

//endregion serve
