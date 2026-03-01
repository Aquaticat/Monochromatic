/** Public API for @monochromatic-dev/mcp-stdio. */
export { createMcpServer, defineTool } from './server.ts';
export { serve } from './transport.ts';
export type { StdoutWriter } from './transport.ts';
export type {
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcErrorResponse,
  JsonRpcErrorDetail,
  JsonRpcOutbound,
  JsonRpcInbound,
} from './json-rpc.ts';
export { isJsonRpcMessage } from './json-rpc.ts';
export type {
  ToolDefinition,
  ToolInputSchema,
  ToolContent,
  ToolCallResult,
  ToolHandler,
} from './protocol.ts';
export type { McpServerConfig, McpServerHandle, RegisteredTool, ToolEntry } from './server-types.ts';
