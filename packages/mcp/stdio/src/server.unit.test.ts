import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createMcpServer,
  defineTool,
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_METHOD_NOT_FOUND,
  type JsonRpcErrorResponse,
  type JsonRpcInbound,
  type JsonRpcResponse,
  NO_RESPONSE,
  PROTOCOL_VERSION,
  type ToolEntry,
} from '@monochromatic-dev/mcp-stdio';

/** Reusable test tool that echoes arguments back as text content. */
const echoTool: ToolEntry = {
  name: 'echo',
  description: 'Echoes arguments.',
  inputSchema: { type: 'object', properties: { text: { type: 'string', }, }, },
  handler: (args: Readonly<Record<string, unknown>>,) => ({
    content: [{ type: 'text', text: JSON.stringify(args,), },],
  }),
};

//region defineTool: bundles name with tool entry options

await describe({
  name: '',
  children: [
    describe({
      name: defineTool.name,
      children: [
        it({
          name: 'returns a ToolEntry with the given name and options',
          fn: async () => {
            const entry = defineTool({
              name: 'greet',
              entry: {
                description: 'Greets by name.',
                handler: () => ({ content: [{ type: 'text', text: 'hello', },], }),
              },
            },);
            expect(entry.name,).toBe('greet',);
            expect(entry.description,).toBe('Greets by name.',);
          },
        },),
        it({
          name: 'preserves inputSchema when provided',
          fn: async () => {
            const schema = { type: 'object' as const,
              properties: { name: { type: 'string', }, }, required: ['name',] as const, };
            const entry = defineTool({
              name: 'test',
              entry: {
                description: 'Test tool.',
                inputSchema: schema,
                handler: () => ({ content: [{ type: 'text', text: 'ok', },], }),
              },
            },);
            expect(entry.inputSchema,).toEqual(schema,);
          },
        },),
        it({
          name: 'leaves inputSchema undefined when not provided',
          fn: async () => {
            const entry = defineTool({
              name: 'test',
              entry: {
                description: 'Test tool.',
                handler: () => ({ content: [{ type: 'text', text: 'ok', },], }),
              },
            },);
            expect(entry.inputSchema,).toBeUndefined();
          },
        },),
      ],
    },),

    //endregion defineTool

    //region createMcpServer: builds immutable server and dispatches messages

    describe({
      name: createMcpServer.name,
      children: [
        //region initialize: returns server identity and capabilities

        describe({
          name: 'initialize',
          children: [
            it({
              name: 'responds with protocol version, capabilities, and server info',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'test-server', version: '1.0.0', },
                  tools: [],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 1,
                  method: 'initialize', };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response,).toEqual({
                  jsonrpc: '2.0',
                  id: 1,
                  result: {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: { tools: {}, },
                    serverInfo: { name: 'test-server', version: '1.0.0', },
                  },
                },);
              },
            },),
            it({
              name: 'echoes the request id',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 'string-id',
                  method: 'initialize', };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.id,).toBe('string-id',);
              },
            },),
          ],
        },),

        //endregion initialize

        //region ping: responds with empty object

        describe({
          name: 'ping',
          children: [
            it({
              name: 'responds with empty result',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 2,
                  method: 'ping', };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.result,).toEqual({},);
              },
            },),
          ],
        },),

        //endregion ping

        //region tools/list: returns registered tool definitions

        describe({
          name: 'tools/list',
          children: [
            it({
              name: 'returns empty tools array when no tools registered',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 3,
                  method: 'tools/list', };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.result,).toEqual({ tools: [], },);
              },
            },),
            it({
              name: 'returns all registered tools with definitions',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 4,
                  method: 'tools/list', };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.result,).toEqual({
                  tools: [
                    {
                      name: 'echo',
                      description: 'Echoes arguments.',
                      inputSchema: { type: 'object',
                        properties: { text: { type: 'string', }, }, },
                    },
                  ],
                },);
              },
            },),
            it({
              name: 'defaults inputSchema to empty object schema when not provided',
              fn: async () => {
                const tool: ToolEntry = {
                  name: 'no-schema',
                  description: 'No explicit schema.',
                  handler: () => ({ content: [{ type: 'text', text: 'ok', },], }),
                };
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [tool,],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 5,
                  method: 'tools/list', };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                const { tools, } = response.result as {
                  tools: readonly { inputSchema: unknown; }[];
                };
                expect(tools[0]?.inputSchema,).toEqual({ type: 'object', },);
              },
            },),
            it({
              name: 'lists multiple tools in registration order',
              fn: async () => {
                const toolA: ToolEntry = {
                  name: 'alpha',
                  description: 'First tool.',
                  handler: () => ({ content: [{ type: 'text', text: 'a', },], }),
                };
                const toolB: ToolEntry = {
                  name: 'beta',
                  description: 'Second tool.',
                  handler: () => ({ content: [{ type: 'text', text: 'b', },], }),
                };
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [toolA, toolB,],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 6,
                  method: 'tools/list', };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                const names =
                  (response.result as { tools: readonly { name: string; }[]; })
                    .tools
                    .map(
                      tool => tool.name,
                    );
                expect(names,).toEqual(['alpha', 'beta',],);
              },
            },),
          ],
        },),

        //endregion tools/list

        //region tools/call: dispatches to registered tool handlers

        describe({
          name: 'tools/call',
          children: [
            it({
              name: 'calls the correct tool handler and returns result',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 7,
                  method: 'tools/call',
                  params: { name: 'echo', arguments: { text: 'hello', }, },
                };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.result,).toEqual({
                  content: [{ type: 'text', text: '{"text":"hello"}', },],
                },);
              },
            },),
            it({
              name: 'returns error for unknown tool name',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 8,
                  method: 'tools/call',
                  params: { name: 'nonexistent', },
                };
                const response = await server.handleMessage(
                  request,
                ) as JsonRpcErrorResponse;
                expect(response.error.code,).toBe(JSON_RPC_INVALID_PARAMS,);
                expect(response.error.message,).toContain('nonexistent',);
              },
            },),
            it({
              name: 'returns error when tool name is missing',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 9,
                  method: 'tools/call',
                  params: {},
                };
                const response = await server.handleMessage(
                  request,
                ) as JsonRpcErrorResponse;
                expect(response.error.code,).toBe(JSON_RPC_INVALID_PARAMS,);
              },
            },),
            it({
              name: 'returns error when tool name is not a string',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 10,
                  method: 'tools/call',
                  params: { name: 42, },
                } as unknown as JsonRpcInbound;
                const response = await server.handleMessage(
                  request,
                ) as JsonRpcErrorResponse;
                expect(response.error.code,).toBe(JSON_RPC_INVALID_PARAMS,);
              },
            },),
            it({
              name: 'defaults arguments to empty object when not provided',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 11,
                  method: 'tools/call',
                  params: { name: 'echo', },
                };
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.result,).toEqual({
                  content: [{ type: 'text', text: '{}', },],
                },);
              },
            },),
            it({
              name: 'defaults arguments to empty object when arguments is null',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 12,
                  method: 'tools/call',
                  params: { name: 'echo', arguments: null, },
                } as unknown as JsonRpcInbound;
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.result,).toEqual({
                  content: [{ type: 'text', text: '{}', },],
                },);
              },
            },),
            it({
              name: 'defaults arguments to empty object when arguments is an array',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [echoTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 13,
                  method: 'tools/call',
                  params: { name: 'echo', arguments: [1, 2,], },
                } as unknown as JsonRpcInbound;
                const response = await server.handleMessage(request,) as JsonRpcResponse;
                expect(response.result,).toEqual({
                  content: [{ type: 'text', text: '{}', },],
                },);
              },
            },),
            it({
              name: 'returns internal error when handler throws',
              fn: async () => {
                const failingTool: ToolEntry = {
                  name: 'fail',
                  description: 'Always fails.',
                  handler: () => {
                    throw new Error('deliberate failure',);
                  },
                };
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [failingTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 14,
                  method: 'tools/call',
                  params: { name: 'fail', },
                };
                const response = await server.handleMessage(
                  request,
                ) as JsonRpcErrorResponse;
                expect(response.error.code,).toBe(JSON_RPC_INTERNAL_ERROR,);
                expect(response.error.message,).toContain('deliberate failure',);
              },
            },),
            it({
              name: 'handles non-Error thrown values',
              fn: async () => {
                const throwStringTool: ToolEntry = {
                  name: 'throw-string',
                  description: 'Throws a string.',
                  handler: () => {
                    // oxlint-disable-next-line eslint/no-throw-literal, typescript/only-throw-error -- testing non-Error throw
                    throw 'string-error';
                  },
                };
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [throwStringTool,],
                },);
                const request: JsonRpcInbound = {
                  jsonrpc: '2.0',
                  id: 15,
                  method: 'tools/call',
                  params: { name: 'throw-string', },
                };
                const response = await server.handleMessage(
                  request,
                ) as JsonRpcErrorResponse;
                expect(response.error.message,).toContain('string-error',);
              },
            },),
          ],
        },),

        //endregion tools/call

        //region unknown method: returns method not found error

        describe({
          name: 'unknown method',
          children: [
            it({
              name: 'returns method not found error',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [],
                },);
                const request: JsonRpcInbound = { jsonrpc: '2.0', id: 16,
                  method: 'unknown/method', };
                const response = await server.handleMessage(
                  request,
                ) as JsonRpcErrorResponse;
                expect(response.error.code,).toBe(JSON_RPC_METHOD_NOT_FOUND,);
                expect(response.error.message,).toContain('unknown/method',);
              },
            },),
          ],
        },),

        //endregion unknown method

        //region notifications: returns the no-response sentinel for notifications

        describe({
          name: 'notifications',
          children: [
            it({
              name: 'returns NO_RESPONSE for notifications/initialized',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [],
                },);
                const notification: JsonRpcInbound = { jsonrpc: '2.0',
                  method: 'notifications/initialized', };
                const result = await server.handleMessage(notification,);
                expect(result,).toBe(NO_RESPONSE,);
              },
            },),
            it({
              name: 'returns NO_RESPONSE for unexpected notification methods',
              fn: async () => {
                const server = createMcpServer({
                  config: { name: 'srv', version: '0.1.0', },
                  tools: [],
                },);
                const notification: JsonRpcInbound = { jsonrpc: '2.0',
                  method: 'notifications/unknown', };
                const result = await server.handleMessage(notification,);
                expect(result,).toBe(NO_RESPONSE,);
              },
            },),
          ],
        },),
        //endregion notifications
      ],
    },),
    //endregion createMcpServer
  ],
},);
