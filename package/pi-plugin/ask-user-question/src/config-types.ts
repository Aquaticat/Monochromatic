import type { EditorEnvironment, } from './editor-command.ts';

//region Public types

/**
 * Loaded user-level ask-user extension configuration.
 */
export type AskUserQuestionConfig = {
  /**
   * Effective editor executable and configured arguments.
   */
  readonly editorCommand: readonly string[];
  /**
   * Config source metadata for diagnostics.
   */
  readonly source: {
    /**
     * Absolute user config path.
     */
    readonly path: string;
    /**
     * Whether user config file existed.
     */
    readonly loaded: boolean;
  };
};

/**
 * Config loader dependencies overridden by tests.
 */
export type LoadAskUserQuestionConfigOptions = {
  /**
   * Home directory used to locate user-level config.
   */
  readonly home?: string;
  /**
   * Environment used for editor fallback resolution.
   */
  readonly env?: EditorEnvironment;
  /**
   * Runtime platform used for final editor fallback.
   */
  readonly platform?: NodeJS.Platform;
};

//endregion Public types

//region Internal types

/**
 * Validated file shape before precedence is applied.
 */
export type AskUserQuestionConfigFile = {
  /**
   * Optional editor command overriding VISUAL and EDITOR.
   */
  readonly editor?: string;
};

/**
 * Optional config read result with explicit presence marker.
 */
export type AskUserQuestionConfigReadResult = {
  /**
   * Whether config file existed.
   */
  readonly loaded: boolean;
  /**
   * Validated file values.
   */
  readonly value: AskUserQuestionConfigFile;
};

//endregion Internal types

//region Error

/**
 * Reports malformed or unreadable user configuration.
 */
export class AskUserQuestionConfigError extends Error {
  /**
   * Creates config diagnostic retaining original failure.
   *
   * @param message - user-facing config diagnostic
   *
   * @param cause - original parse or filesystem failure
   */
  constructor(
    message: string,
    cause?: unknown,
  ) {
    super(
      message,
      cause === undefined
        ? undefined
        : { cause, },
    );
    this.name = 'AskUserQuestionConfigError';
  }
}

//endregion Error
