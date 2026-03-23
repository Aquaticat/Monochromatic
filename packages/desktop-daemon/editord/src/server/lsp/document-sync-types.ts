/**
 * Types for LSP document lifecycle tracking.
 *
 * Shared between document-sync.ts and lsp-manager.ts.
 */

import type { LspClient, } from './lsp-client.ts';

/** State tracked per open document. */
export type DocumentState = {
  /** Monotonically increasing version number. */
  version: number;
  /** LSP language identifier. */
  languageId: string;
  /** Latest full document text. */
  text: string;
};

/** Three LSP server slots passed to sync functions. */
export type ServerSlots = {
  oxlint: LspClient | null;
  tsgo: LspClient | null;
  dprint: LspClient | null;
};
