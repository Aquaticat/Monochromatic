//region Preparation attempt namespace failures

/**
 * Operations of exclusive namespace creation, not model-quality or phase-approval outcomes.
 *
 * @example
 * ```ts
 * const operation: PreparationAttemptOperation = 'write-plan';
 * ```
 */
export type PreparationAttemptOperation = 'plan-syntax' | 'file-name' | 'create-directory' | 'write-plan' | 'write-identity'
  | 'read-directory' | 'read-plan' | 'read-identity' | 'identity';

/**
 * Privacy-safe failure retaining any incomplete owned directory for inspection rather than silently retrying it.
 *
 * @example
 * ```ts
 * throw new PreparationAttemptError({ operation: 'write-plan', dir, cause });
 * ```
 */
export class PreparationAttemptError extends Error {
  /**
   * Diagnostic contains an authored operation and caller-selected or created directory only.
   */
  public readonly messageNamesOnly: true = true;
  /**
   * Failed namespace operation, without plan content.
   */
  public readonly operation: PreparationAttemptOperation;
  /**
   * Directory to inspect; not a claim that the attempt is sealed or approved.
   */
  public readonly dir: string;

  /**
   * Builds an actionable namespace failure without echoing private root-plan bytes.
   *
   * @param operation - failed namespace step
   *
   * @param dir - supplied parent or newly created attempt directory
   *
   * @param cause - underlying filesystem or JSON failure
   *
   * @example
   * ```ts
   * new PreparationAttemptError({ operation: 'create-directory', dir, cause });
   * ```
   */
  public constructor({
    operation,
    dir,
    cause,
  }: {
    readonly operation: PreparationAttemptOperation;
    readonly dir: string;
    readonly cause?: unknown;
  },) {
    super(
      `Preparation attempt ${operation} failed at ${dir}. Inspect retained files; do not treat a partial namespace as a reviewed phase or retry a claimed acquisition.`,
      ...(cause === undefined ? [] : [{ cause, },]),
    );
    this.name = 'PreparationAttemptError';
    this.operation = operation;
    this.dir = dir;
  }
}

//endregion Preparation attempt namespace failures
