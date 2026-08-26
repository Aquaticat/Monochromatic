import {
  INVALID_EXEC,
  tokenizeExec,
} from '@monochromatic-dev/cli-terminal-exec/ts/tokenize.ts';

//region Types

/**
 * Environment keys used to resolve a preferred editor.
 */
export type EditorEnvironment = {
  /**
   * Preferred full-screen editor command.
   */
  readonly VISUAL?: string;
  /**
   * General editor command fallback.
   */
  readonly EDITOR?: string;
};

//endregion Types

//region Error

/**
 * Reports an editor command that cannot become a safe executable argument vector.
 *
 * @example
 * ```ts
 * new EditorCommandError('EDITOR contains unsupported syntax.');
 * ```
 */
export class EditorCommandError extends Error {
  /**
   * Creates an editor configuration diagnostic.
   *
   * @param message - actionable editor-resolution message
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'EditorCommandError';
  }
}

//endregion Error

//region Resolution

/**
 * Resolves a blocking editor command from standard environment variables.
 *
 * `$VISUAL` takes precedence over `$EDITOR`.
 * Windows falls back to `notepad.exe`;
 * other platforms fall back to `vi`.
 *
 * @param env - editor environment
 *
 * @param platform - runtime operating-system identifier
 *
 * @returns executable followed by configured editor arguments
 *
 * @throws {@link EditorCommandError} when selected command is empty or uses unsupported shell syntax
 *
 * @example
 * ```ts
 * resolveEditorCommand({ env: { EDITOR: 'code --wait' }, platform: 'linux' });
 * ```
 */
export function resolveEditorCommand(
  {
    env,
    platform,
  }: {
    readonly env: EditorEnvironment;
    readonly platform: NodeJS.Platform;
  },
): readonly string[] {
  /**
   * Preferred visual editor from external process environment.
   */
  const visual = env.VISUAL;
  if (((typeof visual) === 'string') && (visual.trim()
    .length
    > 0))
    return parseEditorCommand({ command: visual.trim(), },);
  /**
   * General editor from external process environment.
   */
  const editor = env.EDITOR;
  if (((typeof editor) === 'string') && (editor.trim()
    .length
    > 0))
    return parseEditorCommand({ command: editor.trim(), },);
  return parseEditorCommand({
    command: platform === 'win32'
      ? 'notepad.exe'
      : 'vi',
  },);
}

/**
 * Parses one configured editor command through terminal-exec tokenizer.
 *
 * @param command - nonblank editor command
 *
 * @returns executable and configured arguments
 *
 * @throws {@link EditorCommandError} when command uses unsupported syntax
 */
function parseEditorCommand(
  { command, }: { readonly command: string; },
): readonly string[] {
  /**
   * Parsed executable and argument vector.
   */
  const parsed = tokenizeExec({ exec: command, },);
  if ((parsed === INVALID_EXEC) || (parsed.length === 0))
    throw new EditorCommandError(
      'Configured editor command cannot be parsed. Use an executable with optional quoted arguments in VISUAL or EDITOR.',
    );
  return parsed;
}

//endregion Resolution
