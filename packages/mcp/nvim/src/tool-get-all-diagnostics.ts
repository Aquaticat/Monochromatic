/**
 * Handler for the `get_all_diagnostics` MCP tool.
 *
 * Returns diagnostics from both LSP and oxlint CLI across all buffers
 * in every running Neovim instance, merged and deduplicated.
 *
 * @module
 */

import type { ToolCallResult, } from '@monochromatic-dev/mcp-stdio';
import { dedupDiagnostics, } from './dedup.ts';
import { formatDiagnostic, } from './format.ts';
import { runOxlint, } from './lint-runner.ts';
import {
  type Diagnostic,
  type FileDiagnostics,
  getAllDiagnostics,
} from './nvim-client.ts';

import { formatNotes, } from './tool-helpers.ts';

/**
 * Fetches all-buffer diagnostics from every Neovim instance,
 * merges with oxlint CLI results, and formats for MCP response.
 *
 * @returns MCP tool result with formatted diagnostics text grouped by file.
 *
 * @example
 * ```ts
 * const result = await handleGetAllDiagnostics();
 * ```
 */
export async function handleGetAllDiagnostics(): Promise<ToolCallResult> {
  try {
    const editorFiles = await getAllDiagnostics();
    const allPaths = editorFiles.map(function extractPath(fileEntry,) {
      return fileEntry.path;
    },);

    const lintResult = await runOxlint({ files: allPaths, },);

    //region Merge editor and lint diagnostics per file
    const mergedByPath = new Map<string, Diagnostic[]>();

    for (const fileEntry of editorFiles) {
      const lintDiags = lintResult.diagnostics.get(fileEntry.path,) ?? [];
      mergedByPath.set(
        fileEntry.path,
        dedupDiagnostics({
          editor: fileEntry.diagnostics,
          lint: lintDiags,
        },),
      );
    }

    // Include files that only appear in lint output (not open in editor)
    for (const [lintPath, lintDiags,] of lintResult.diagnostics) {
      if (!mergedByPath.has(lintPath,))
        mergedByPath.set(
          lintPath,
          lintDiags,
        );
    }
    //endregion Merge editor and lint diagnostics per file

    const result: FileDiagnostics[] = [...mergedByPath.entries(),].map(
      function toFileDiagnostics([path, diagnostics,],) {
        return {
          path,
          diagnostics,
        };
      },
    );

    if (result.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No diagnostics in any buffer.${formatNotes(lintResult.notes,)}`,
        },],
      };
    }

    const sections = result.map(function formatSection(fileEntry,) {
      const lines = fileEntry.diagnostics.map(function formatLine(diagnostic,) {
        return formatDiagnostic(
          diagnostic,
          '  ',
        );
      },);
      return `${fileEntry.path}\n${lines.join('\n',)}`;
    },);

    return {
      content: [{
        type: 'text',
        text: `${sections.join('\n\n',)}${formatNotes(lintResult.notes,)}`,
      },],
    };
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err,);
    console.error(
      '[mcp-nvim] get_all_diagnostics failed:',
      err,
    );
    return {
      content: [{ type: 'text', text: `Error: ${message}`, },],
      isError: true,
    };
  }
}
