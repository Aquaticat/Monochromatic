/**
 * Shared callback types used across the editord client app modules.
 *
 * Extracted to avoid repeating the same multi-line callback signatures
 * in every `wire*` and event-handler function parameter block.
 */

/**
 * Loads a file from the server into the appropriate viewer.
 * Optionally scrolls to a specific line and character position.
 */
export type LoadFileFn = (
  opts: {
    path: string;
    line?: number | undefined;
    character?: number | undefined;
  },
) => Promise<void>;

/**
 * Returns the absolute path of the currently open file, or null
 * when no file is open.
 */
export type GetCurrentFilePathFn = () => string | null;
