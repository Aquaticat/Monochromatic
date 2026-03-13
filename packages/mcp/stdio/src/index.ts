/** Public API for \@monochromatic-dev/mcp-stdio. */
export { createMcpServer, defineTool } from './server.ts';
export { serve, type StdoutWriter } from './transport.ts';
export {
  isJsonRpcMessage,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcResponse,
  type JsonRpcErrorResponse,
  type JsonRpcErrorDetail,
  type JsonRpcOutbound,
  type JsonRpcInbound,
} from './json-rpc.ts';
export type {
  ToolDefinition,
  ToolInputSchema,
  ToolContent,
  ToolCallResult,
  ToolHandler,
} from './protocol.ts';
export type { McpServerConfig, McpServerHandle, RegisteredTool, ToolEntry } from './server-types.ts';
