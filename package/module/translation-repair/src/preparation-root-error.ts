//region Correspondence root planning refusals

/**
 * Closed failures before a correspondence root or phase can gain review authority.
 *
 * @example
 * ```ts
 * const kind: PreparationRootFailure = 'selection-digest';
 * ```
 */
export type PreparationRootFailure = 'selection-digest' | 'selection-syntax' | 'selection-shape' | 'selection-parents' | 'selection-references' | 'selection-obligations' | 'reference-inventory' | 'reference-content' | 'reference-role' | 'reading-provenance' | 'corpus-identity' | 'corpus-read' | 'population';

/**
 * Fixed diagnostics keep private selection and corpus text out of error rendering.
 */
const ROOT_MESSAGES: Readonly<Record<PreparationRootFailure, string>> = {
  'selection-digest': 'Frozen parent-selection bytes do not match the independently recorded selection digest. Load the task40 artifact and its original expected identity; do not derive approval from the supplied bytes.',
  'selection-syntax': 'Frozen parent selection is not readable JSON. Restore its exact independently bound bytes rather than repairing or replacing the frozen sample.',
  'selection-shape': 'Frozen parent selection lacks supported fields for the baseline identity and reading-completion projection. Verify the intended artifact and its provenance; complete population and nested-metadata validation remain separate root-planning work.',
  'selection-parents': 'Frozen parent identities, order or reading counts do not describe the required forty-parent selection. Abort or explicitly reopen selection; do not redraw, substitute or pad parents.',
  'selection-references': 'Frozen selection references are missing, duplicated or malformed. Restore the original reference inventory; every referenced artifact still needs independent byte verification before root planning.',
  'selection-obligations': 'Frozen selection does not retain one source-context obligation record for each ordered parent. Restore its complete reading evidence; unresolved source channels cannot become implicit call authority.',
  'reference-inventory': 'Supplied supporting artifacts do not match the complete frozen reference inventory exactly once. Load only the original registered references; do not add, omit or substitute supporting inputs.',
  'reference-content': 'Supporting artifact bytes cannot be read or do not match their frozen SHA-256. Restore the original exact bytes before semantic root construction; decoded, partial or altered content does not verify the reference.',
  'reference-role': 'A frozen supporting artifact does not satisfy its registered content relationship. Restore the original pool and reading artifacts; a filename or matching byte hash alone does not establish semantic ownership.',
  'reading-provenance': 'Frozen entry or parent reading evidence does not match its current pinned text, frame or source obligations. Abort or explicitly reopen selection; do not substitute notes or treat unresolved qualification as approval.',
  'corpus-identity': 'The independently supplied corpus pin or native entry inventory does not match the frozen selection. Use its original pinned corpus; do not follow a location or revision merely because a supporting document names it.',
  'corpus-read': 'Current pinned corpus bytes could not be read. Verify the clone, pinned commit, file access and native Git availability; only a missing object inside a readable pinned corpus is an eligibility exclusion.',
  'population': 'Current policy eligibility, parent coordinates or frozen population identities differ. Abort or explicitly reopen task40; do not redraw, substitute or broaden the forty frozen parent scopes.',
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
  /** Input locator or entry identity, never private artifact or corpus content. */
  public readonly input?: string;
  /**
   * Constructs an input-specific refusal and its allowed recovery.
   *
   * @param kind - violated frozen planning boundary
   *
   * @param input - safe locator or identity naming the affected read
   *
   * @example
   * ```ts
   * new PreparationRootError({ kind: 'selection-parents' });
   * ```
   */
  public constructor({ kind, input, }: { readonly kind: PreparationRootFailure; readonly input?: string; },) {
    super(input === undefined ? ROOT_MESSAGES[kind] : `${ROOT_MESSAGES[kind]} Input: ${JSON.stringify(input,)}.`,);
    this.name = 'PreparationRootError';
    this.kind = kind;
    if (input !== undefined)
      this.input = input;
  }
}

//endregion Correspondence root planning refusals
