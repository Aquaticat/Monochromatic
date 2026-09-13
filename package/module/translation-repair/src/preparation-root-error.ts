//region Correspondence root planning refusals

/**
 * Closed failures before a correspondence root or phase can gain review authority.
 *
 * @example
 * ```ts
 * const kind: PreparationRootFailure = 'selection-digest';
 * ```
 */
export type PreparationRootFailure = 'selection-digest' | 'selection-syntax' | 'selection-shape' | 'selection-parents' | 'selection-references' | 'selection-obligations';

/**
 * Fixed diagnostics keep private selection and corpus text out of error rendering.
 */
const ROOT_MESSAGES: Readonly<Record<PreparationRootFailure, string>> = {
  'selection-digest': 'Frozen parent-selection bytes do not match the independently recorded selection digest. Load the task40 artifact and its original expected identity; do not derive approval from the supplied bytes.',
  'selection-syntax': 'Frozen parent selection is not readable JSON. Restore its exact independently bound bytes rather than repairing or replacing the frozen sample.',
  'selection-shape': 'Frozen parent selection does not have the supported reading-complete, baseline-coordinate format. Verify the intended selection artifact and its provenance before planning acquisition.',
  'selection-parents': 'Frozen parent identities, order or reading counts do not describe the required forty-parent selection. Abort or explicitly reopen selection; do not redraw, substitute or pad parents.',
  'selection-references': 'Frozen selection references are missing, duplicated or malformed. Restore the original reference inventory; every referenced artifact still needs independent byte verification before root planning.',
  'selection-obligations': 'Frozen selection does not retain one source-context obligation record for each ordered parent. Restore its complete reading evidence; unresolved source channels cannot become implicit call authority.',
};

/**
 * Privacy-safe refusal at frozen selection and correspondence root planning boundaries.
 *
 * @example
 * ```ts
 * throw new PreparationRootError({ kind: 'selection-digest' });
 * ```
 */
export class PreparationRootError extends Error {
  /**
   * Only authored diagnostic text is rendered.
   */
  public readonly messageNamesOnly: true = true;
  /**
   * Failed input boundary without private data.
   */
  public readonly kind: PreparationRootFailure;
  /**
   * Constructs an input-specific refusal and its allowed recovery.
   *
   * @param kind - violated frozen planning boundary
   *
   * @example
   * ```ts
   * new PreparationRootError({ kind: 'selection-parents' });
   * ```
   */
  public constructor({ kind, }: { readonly kind: PreparationRootFailure; },) {
    super(ROOT_MESSAGES[kind],);
    this.name = 'PreparationRootError';
    this.kind = kind;
  }
}

//endregion Correspondence root planning refusals
