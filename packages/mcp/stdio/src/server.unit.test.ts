import {
  describe,
  expect,
  test,
} from 'bun:test';

import {
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_METHOD_NOT_FOUND,
  type JsonRpcInbound,
  type JsonRpcErrorResponse,
  type JsonRpcResponse,
} from './json-rpc.ts';
import { PROTOCOL_VERSION } from './protocol.ts';
import { createMcpServer, defineTool } from './server.ts';

import type { ToolEntry } from './server-types.ts';

//region defineTool -- bundles name with tool entry options

describe('defineTool', () => {
  test('returns a ToolEntry with the given name and options', () => {
    expect.assertions(2);
    const entry = defineTool('greet', {
      description: 'Greets by name.',
      handler: async () => ({ content: [{ type: 'text', text: 'hello' }] }),
    });
    expect(entry.name).toBe('greet');
    expect(entry.description).toBe('Greets by name.');
  });

  test('preserves inputSchema when provided', () => {
    expect.assertions(1);
    const schema = { type: 'object' as const, properties: { name: { type: 'string' } }, required: ['name'] as const };
    const entry = defineTool('test', {
      description: 'Test tool.',
      inputSchema: schema,
      handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });
    expect(entry.inputSchema).toEqual(schema);
  });

  test('leaves inputSchema undefined when not provided', () => {
    expect.assertions(1);
    const entry = defineTool('test', {
      description: 'Test tool.',
      handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });
    expect(entry.inputSchema).toBeUndefined();
  });
});

//endregion defineTool

//region createMcpServer -- builds immutable server and dispatches messages

describe('createMcpServer', () => {
  /** Reusable test tool that echoes arguments back as text content. */
  const echoTool: ToolEntry = {
    name: 'echo',
    description: 'Echoes arguments.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
    handler: async (args: Record<string, unknown>) => ({
      content: [{ type: 'text', text: JSON.stringify(args) }],
    }),
  };

  //region initialize -- returns server identity and capabilities

  describe('initialize', () => {
    test('responds with protocol version, capabilities, and server info', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'test-server', version: '1.0.0' }, []);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 1, method: 'initialize' };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'test-server', version: '1.0.0' },
        },
      });
    });

    test('echoes the request id', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, []);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 'string-id', method: 'initialize' };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.id).toBe('string-id');
    });
  });

  //endregion initialize

  //region ping -- responds with empty object

  describe('ping', () => {
    test('responds with empty result', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, []);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 2, method: 'ping' };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.result).toEqual({});
    });
  });

  //endregion ping

  //region tools/list -- returns registered tool definitions

  describe('tools/list', () => {
    test('returns empty tools array when no tools registered', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, []);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 3, method: 'tools/list' };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.result).toEqual({ tools: [] });
    });

    test('returns all registered tools with definitions', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 4, method: 'tools/list' };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.result).toEqual({
        tools: [
          {
            name: 'echo',
            description: 'Echoes arguments.',
            inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
          },
        ],
      });
    });

    test('defaults inputSchema to empty object schema when not provided', async () => {
      expect.assertions(1);
      const tool: ToolEntry = {
        name: 'no-schema',
        description: 'No explicit schema.',
        handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      };
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [tool]);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 5, method: 'tools/list' };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      const tools = (response.result as { tools: readonly { inputSchema: unknown }[] }).tools;
      expect(tools[0]?.inputSchema).toEqual({ type: 'object' });
    });

    test('lists multiple tools in registration order', async () => {
      expect.assertions(1);
      const toolA: ToolEntry = {
        name: 'alpha',
        description: 'First tool.',
        handler: async () => ({ content: [{ type: 'text', text: 'a' }] }),
      };
      const toolB: ToolEntry = {
        name: 'beta',
        description: 'Second tool.',
        handler: async () => ({ content: [{ type: 'text', text: 'b' }] }),
      };
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [toolA, toolB]);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 6, method: 'tools/list' };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      const names = (response.result as { tools: readonly { name: string }[] }).tools.map(
        (tool) => tool.name,
      );
      expect(names).toEqual(['alpha', 'beta']);
    });
  });

  //endregion tools/list

  //region tools/call -- dispatches to registered tool handlers

  describe('tools/call', () => {
    test('calls the correct tool handler and returns result', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'echo', arguments: { text: 'hello' } },
      };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.result).toEqual({
        content: [{ type: 'text', text: '{"text":"hello"}' }],
      });
    });

    test('returns error for unknown tool name', async () => {
      expect.assertions(2);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: { name: 'nonexistent' },
      };
      const response = await server.handleMessage(request) as JsonRpcErrorResponse;
      expect(response.error.code).toBe(JSON_RPC_INVALID_PARAMS);
      expect(response.error.message).toContain('nonexistent');
    });

    test('returns error when tool name is missing', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {},
      };
      const response = await server.handleMessage(request) as JsonRpcErrorResponse;
      expect(response.error.code).toBe(JSON_RPC_INVALID_PARAMS);
    });

    test('returns error when tool name is not a string', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: { name: 42 },
      } as unknown as JsonRpcInbound;
      const response = await server.handleMessage(request) as JsonRpcErrorResponse;
      expect(response.error.code).toBe(JSON_RPC_INVALID_PARAMS);
    });

    test('defaults arguments to empty object when not provided', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: { name: 'echo' },
      };
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.result).toEqual({
        content: [{ type: 'text', text: '{}' }],
      });
    });

    test('defaults arguments to empty object when arguments is null', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: { name: 'echo', arguments: null },
      } as unknown as JsonRpcInbound;
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.result).toEqual({
        content: [{ type: 'text', text: '{}' }],
      });
    });

    test('defaults arguments to empty object when arguments is an array', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [echoTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: { name: 'echo', arguments: [1, 2] },
      } as unknown as JsonRpcInbound;
      const response = await server.handleMessage(request) as JsonRpcResponse;
      expect(response.result).toEqual({
        content: [{ type: 'text', text: '{}' }],
      });
    });

    test('returns internal error when handler throws', async () => {
      expect.assertions(2);
      const failingTool: ToolEntry = {
        name: 'fail',
        description: 'Always fails.',
        handler: async () => {
          throw new Error('deliberate failure');
        },
      };
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [failingTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: { name: 'fail' },
      };
      const response = await server.handleMessage(request) as JsonRpcErrorResponse;
      expect(response.error.code).toBe(JSON_RPC_INTERNAL_ERROR);
      expect(response.error.message).toContain('deliberate failure');
    });

    test('handles non-Error thrown values', async () => {
      expect.assertions(1);
      const throwStringTool: ToolEntry = {
        name: 'throw-string',
        description: 'Throws a string.',
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- testing non-Error throw
        handler: async () => { throw 'string-error'; },
      };
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, [throwStringTool]);
      const request: JsonRpcInbound = {
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: { name: 'throw-string' },
      };
      const response = await server.handleMessage(request) as JsonRpcErrorResponse;
      expect(response.error.message).toContain('string-error');
    });
  });

  //endregion tools/call

  //region unknown method -- returns method not found error

  describe('unknown method', () => {
    test('returns method not found error', async () => {
      expect.assertions(2);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, []);
      const request: JsonRpcInbound = { jsonrpc: '2.0', id: 16, method: 'unknown/method' };
      const response = await server.handleMessage(request) as JsonRpcErrorResponse;
      expect(response.error.code).toBe(JSON_RPC_METHOD_NOT_FOUND);
      expect(response.error.message).toContain('unknown/method');
    });
  });

  //endregion unknown method

  //region notifications -- returns undefined for notifications

  describe('notifications', () => {
    test('returns undefined for notifications/initialized', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, []);
      const notification: JsonRpcInbound = { jsonrpc: '2.0', method: 'notifications/initialized' };
      const result = await server.handleMessage(notification);
      expect(result).toBeUndefined();
    });

    test('returns undefined for unexpected notification methods', async () => {
      expect.assertions(1);
      const server = createMcpServer({ name: 'srv', version: '0.1.0' }, []);
      const notification: JsonRpcInbound = { jsonrpc: '2.0', method: 'notifications/unknown' };
      const result = await server.handleMessage(notification);
      expect(result).toBeUndefined();
    });
  });

  //endregion notifications
});

//endregion createMcpServer
