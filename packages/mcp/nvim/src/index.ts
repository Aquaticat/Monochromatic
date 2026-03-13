#!/usr/bin/env bun
import { createMcpServer, defineTool, serve } from "@monochromatic-dev/mcp-stdio";

import { dedupDiagnostics } from "./dedup.ts";
import { formatDiagnostic } from "./format.ts";
import { runOxlint } from "./lint-runner.ts";
import { getAllDiagnostics, getCurrentFiles, type CurrentFile, type Diagnostic, type FileDiagnostics } from "./nvim-client.ts";

/**
 * Builds a caveat note when any current buffer has unsaved changes.
 * CLI linters see the on-disk version, which may differ from the buffer.
 *
 * @param files - Current file metadata from all Neovim instances.
 *
 * @returns Caveat string or empty string when no buffers are modified.
 */
function modifiedCaveat(files: readonly CurrentFile[]): string {
  const modifiedPaths = files
    .filter(function isModified(file) { return file.modified; })
    .map(function getPath(file) { return file.path; });

  if (modifiedPaths.length === 0) {
    return "";
  }
  if (modifiedPaths.length === 1) {
    return `buffer has unsaved changes; CLI lint results reflect the saved file, not the current buffer: ${modifiedPaths[0]}`;
  }
  return `some buffers have unsaved changes; CLI lint results reflect saved files, not current buffers: ${modifiedPaths.join(", ")}`;
}

/**
 * Joins caveat notes into a single block, prefixed with a blank line.
 *
 * @param notes - Array of note strings to join.
 *
 * @returns Formatted notes block or empty string when no notes.
 */
function formatNotes(notes: readonly string[]): string {
  if (notes.length === 0) {
    return "";
  }
  const formattedNotes = notes.map(function prefixNote(note) {
    return `(note: ${note})`;
  }).join("\n");
  return `\n\n${formattedNotes}`;
}

/**
 * Builds a header showing current file info from all Neovim instances.
 *
 * @param files - Current file metadata from all instances.
 *
 * @returns Multi-line header string.
 */
function buildHeader(files: readonly CurrentFile[]): string {
  const [firstFile] = files;
  if (files.length === 1 && firstFile !== undefined) {
    return `path: ${firstFile.path}\nfiletype: ${firstFile.filetype}\nmodified: ${firstFile.modified}`;
  }

  return files.map(function formatEntry(file, index) {
    return `[instance ${index + 1}] path: ${file.path} | filetype: ${file.filetype} | modified: ${file.modified}`;
  }).join("\n");
}

/** MCP server exposing Neovim diagnostics merged with CLI lint results. */
const server = createMcpServer(
  { name: "nvim", version: "0.1.0" },
  [
    defineTool("get_diagnostics", {
      description:
        "Returns the current buffer from every running Neovim instance, "
        + "with diagnostics from both LSP and oxlint CLI (merged and deduplicated). "
        + "Each diagnostic includes severity (ERROR/WARN/INFO/HINT), line, column, message, source, and code.",
      handler: async function handleGetDiagnostics() {
        try {
          const files = await getCurrentFiles();
          const header = buildHeader(files);

          const uniquePaths = [...new Set(files.map(function getPath(file) { return file.path; }))];

          // Query all editor diagnostics and lint in parallel, then filter to current files.
          // Using getAllDiagnostics gives us per-file grouping across all instances.
          const [allEditorFiles, lintResult] = await Promise.all([
            getAllDiagnostics(),
            runOxlint({ files: uniquePaths }),
          ]);
          const currentPathSet = new Set(uniquePaths);

          const mergedByPath = new Map<string, Diagnostic[]>();

          for (const fileEntry of allEditorFiles) {
            if (!currentPathSet.has(fileEntry.path)) {
              continue;
            }
            const lintDiags = lintResult.diagnostics.get(fileEntry.path) ?? [];
            mergedByPath.set(
              fileEntry.path,
              dedupDiagnostics({ editor: fileEntry.diagnostics, lint: lintDiags }),
            );
          }

          // Include current files that have lint-only diagnostics (not reported by LSP)
          for (const filePath of uniquePaths) {
            if (!mergedByPath.has(filePath)) {
              const lintDiags = lintResult.diagnostics.get(filePath) ?? [];
              if (lintDiags.length > 0) {
                mergedByPath.set(filePath, lintDiags);
              }
            }
          }
          //endregion Merge editor and lint diagnostics per file

          const allNotes = [...lintResult.notes];
          const caveat = modifiedCaveat(files);
          if (caveat.length > 0) {
            allNotes.push(caveat);
          }

          const allMerged = [...mergedByPath.values()].flat();

          if (allMerged.length === 0) {
            return {
              content: [{
                type: "text",
                text: `${header}\n\nNo diagnostics in current buffers.${formatNotes(allNotes)}`,
              }],
            };
          }

          // Single file: flat list. Multiple files: grouped by path.
          if (mergedByPath.size === 1) {
            const lines = allMerged.map(function formatLine(diagnostic) {
              return formatDiagnostic(diagnostic);
            });
            return {
              content: [{
                type: "text",
                text: `${header}\n\n${lines.join("\n")}${formatNotes(allNotes)}`,
              }],
            };
          }

          const sections = [...mergedByPath.entries()].map(
            function formatSection([path, diagnostics]) {
              const lines = diagnostics.map(function formatLine(diagnostic) {
                return formatDiagnostic(diagnostic, "  ");
              });
              return `${path}\n${lines.join("\n")}`;
            },
          );

          return {
            content: [{
              type: "text",
              text: `${header}\n\n${sections.join("\n\n")}${formatNotes(allNotes)}`,
            }],
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[mcp-nvim] get_diagnostics failed:", err);
          return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
        }
      },
    }),

    defineTool("get_all_diagnostics", {
      description:
        "Returns diagnostics from both LSP and oxlint CLI across all buffers in every running Neovim instance, "
        + "merged and deduplicated, grouped by file path. "
        + "Use when you need a project-wide view of errors and warnings.",
      handler: async function handleGetAllDiagnostics() {
        try {
          const editorFiles = await getAllDiagnostics();
          const allPaths = editorFiles.map(function extractPath(fileEntry) {
            return fileEntry.path;
          });

          const lintResult = await runOxlint({ files: allPaths });

          //region Merge editor and lint diagnostics per file
          const mergedByPath = new Map<string, Diagnostic[]>();

          for (const fileEntry of editorFiles) {
            const lintDiags = lintResult.diagnostics.get(fileEntry.path) ?? [];
            mergedByPath.set(
              fileEntry.path,
              dedupDiagnostics({ editor: fileEntry.diagnostics, lint: lintDiags }),
            );
          }

          // Include files that only appear in lint output (not open in editor)
          for (const [lintPath, lintDiags] of lintResult.diagnostics) {
            if (!mergedByPath.has(lintPath)) {
              mergedByPath.set(lintPath, lintDiags);
            }
          }
          //endregion Merge editor and lint diagnostics per file

          const result: FileDiagnostics[] = [...mergedByPath.entries()].map(
            function toFileDiagnostics([path, diagnostics]) {
              return { path, diagnostics };
            },
          );

          if (result.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No diagnostics in any buffer.${formatNotes(lintResult.notes)}`,
              }],
            };
          }

          const sections = result.map(function formatSection(fileEntry) {
            const lines = fileEntry.diagnostics.map(function formatLine(diagnostic) {
              return formatDiagnostic(diagnostic, "  ");
            });
            return `${fileEntry.path}\n${lines.join("\n")}`;
          });

          return {
            content: [{
              type: "text",
              text: `${sections.join("\n\n")}${formatNotes(lintResult.notes)}`,
            }],
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[mcp-nvim] get_all_diagnostics failed:", err);
          return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
        }
      },
    }),
  ],
);

await serve(server);
