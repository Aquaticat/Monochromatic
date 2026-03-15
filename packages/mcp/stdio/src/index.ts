/** Public API for \@monochromatic-dev/mcp-stdio. */
export {
  isJsonRpcMessage,
  type JsonRpcErrorDetail,
  type JsonRpcErrorResponse,
  type JsonRpcId,
  type JsonRpcInbound,
  type JsonRpcNotification,
  type JsonRpcOutbound,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './json-rpc.ts';
export type {
  ToolCallResult,
  ToolContent,
  ToolDefinition,
  ToolHandler,
  ToolInputSchema,
} from './protocol.ts';
export type {
  McpServerConfig,
  McpServerHandle,
  RegisteredTool,
  ToolEntry,
} from './server-types.ts';
export {
  createMcpServer,
  defineTool,
} from './server.ts';
export {
  serve,
  type StdoutWriter,
} from './transport.ts';
