/**
 * LSP initialize request parameter construction.
 *
 * Builds the capabilities and workspace configuration
 * for the LSP initialize handshake.
 */

/**
 * Constructs the params object for an LSP `initialize` request.
 *
 * @param rootUri - workspace root URI (e.g. `file:///home/user/project`)
 *
 * @param initializationOptions - additional server-specific initialization options
 *
 * @returns params suitable for a JSON-RPC initialize request
 *
 * @example
 * ```ts
 * const result = buildInitializeParams({ rootUri: 'file:///home/user/project', initializationOptions: {}, });
 * ```
 */
export function buildInitializeParams({
  rootUri,
  initializationOptions,
}: {
  readonly rootUri: string;
  readonly initializationOptions: Readonly<Record<string, unknown>> | undefined;
},): unknown {
  return {
    processId: process.pid,
    clientInfo: {
      name: 'editord',
      version: '0.1.0',
    },
    rootUri,
    workspaceFolders: [{
      uri: rootUri,
      name: 'root',
    },],
    capabilities: {
      textDocument: {
        synchronization: { didSave: true, },
        hover: { contentFormat: [
          'markdown',
          'plaintext',
        ], },
        completion: { completionItem: { snippetSupport: false, }, },
        publishDiagnostics: {},
        inlayHint: {},
      },
    },
    initializationOptions,
  };
}
