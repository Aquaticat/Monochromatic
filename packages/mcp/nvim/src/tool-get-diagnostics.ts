/**
 * Handler for the `get_diagnostics` MCP tool.
 *
 * Returns the current buffer from every running Neovim instance
 * with diagnostics from both LSP and oxlint CLI, merged and deduplicated.
 *
 * @module
 */

import type { ToolCallResult, } from '@monochromatic-dev/mcp-stdio';
import { dedupDiagnostics, } from './dedup.ts';
import { formatDiagnostic, } from './format.ts';
import { runOxlint, } from './lint-runner.ts';
import {
  type Diagnostic,
  getAllDiagnostics,
  getCurrentFiles,
} from './nvim-client.ts';

import {
  buildHeader,
  formatNotes,
  modifiedCaveat,
} from './tool-helpers.ts';

/**
 * Fetches current-buffer diagnostics from all Neovim instances,
 * merges with oxlint CLI results, and formats for MCP response.
 *
 * @returns MCP tool result with formatted diagnostics text.
 *
 * @example
 * ```ts
 * const result = await handleGetDiagnostics();
 * ```
 */
export async function handleGetDiagnostics(): Promise<ToolCallResult> {
  try {
    const files = await getCurrentFiles();
    const header = buildHeader(files,);

    const uniquePaths = [...new Set(files.map(function getPath(file,) {
      return file.path;
    },),),];

    // Query all editor diagnostics and lint in parallel, then filter to current files.
    // Using getAllDiagnostics gives us per-file grouping across all instances.
    const [allEditorFiles, lintResult,] = await Promise.all([
      getAllDiagnostics(),
      runOxlint({ files: uniquePaths, },),
    ],);
    const currentPathSet = new Set(uniquePaths,);

    //region Merge editor and lint diagnostics per file
    const mergedByPath = new Map<string, Diagnostic[]>();

    for (const fileEntry of allEditorFiles) {
      if (!currentPathSet.has(fileEntry.path,))
        continue;
      const lintDiags = lintResult.diagnostics.get(fileEntry.path,) ?? [];
      mergedByPath.set(
        fileEntry.path,
        dedupDiagnostics({
          editor: fileEntry.diagnostics,
          lint: lintDiags,
        },),
      );
    }

    // Include current files that have lint-only diagnostics (not reported by LSP)
    for (const filePath of uniquePaths) {
      if (!mergedByPath.has(filePath,)) {
        const lintDiags = lintResult.diagnostics.get(filePath,) ?? [];
        if (lintDiags.length > 0)
          mergedByPath.set(
            filePath,
            lintDiags,
          );
      }
    }
    //endregion Merge editor and lint diagnostics per file

    const allNotes = [...lintResult.notes,];
    const caveat = modifiedCaveat(files,);
    if (caveat.length > 0)
      allNotes.push(caveat,);

    const allMerged = [...mergedByPath.values(),].flat();

    if (allMerged.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `${header}\n\nNo diagnostics in current buffers.${
            formatNotes(allNotes,)
          }`,
        },],
      };
    }

    // Single file: flat list. Multiple files: grouped by path.
    if (mergedByPath.size === 1) {
      const lines = allMerged.map(function formatLine(diagnostic,) {
        return formatDiagnostic(diagnostic,);
      },);
      return {
        content: [{
          type: 'text',
          text: `${header}\n\n${lines.join('\n',)}${formatNotes(allNotes,)}`,
        },],
      };
    }

    const sections = [...mergedByPath.entries(),].map(
      function formatSection([path, diagnostics,],) {
        const lines = diagnostics.map(function formatLine(diagnostic,) {
          return formatDiagnostic(
            diagnostic,
            '  ',
          );
        },);
        return `${path}\n${lines.join('\n',)}`;
      },
    );

    return {
      content: [{
        type: 'text',
        text: `${header}\n\n${sections.join('\n\n',)}${formatNotes(allNotes,)}`,
      },],
    };
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err,);
    console.error(
      '[mcp-nvim] get_diagnostics failed:',
      err,
    );
    return {
      content: [{ type: 'text', text: `Error: ${message}`, },],
      isError: true,
    };
  }
}
