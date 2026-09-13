//region Names-only preparation input runner failures

/**
 * Runner operations remain separate from correspondence qualification and paid acquisition.
 *
 * @example
 * ```ts
 * const operation: ProducerInputOperation = 'read-support';
 * ```
 */
export type ProducerInputOperation =
  | 'read-launch'
  | 'verify-runtime'
  | 'verify-host-layout'
  | 'launch-container'
  | 'invoke-application'
  | 'read-selection'
  | 'read-support'
  | 'write-output';

/**
 * Fixed remediation vocabulary never retains parser excerpts, subprocess bodies or corpus text.
 */
const INPUT_RUN_MESSAGES: Readonly<Record<ProducerInputOperation, string>> = {
  'read-launch': 'Preparation input launch does not match its independently recorded contract. Restore the intended launch bytes and identity, or review a newly materialized launch before retrying.',
  'verify-runtime': 'Preparation runtime does not match the recorded execution inputs. Restore the frozen bootstrap, Node, image, library and application files, or review a new launch. Application import was not approved.',
  'verify-host-layout': 'Preparation host directory layout is outside the verified profile. Use canonical authorized directories on one unambiguous visible mount without nested mounts in their trees, or independently review and verify another topology. No content was approved.',
  'launch-container': 'Preparation input container did not complete through its fixed launch contract. Inspect the retained run records and restore its declared tooling and resources. Do not resume or overwrite the partial run.',
  'invoke-application': 'Preparation input application did not complete its fixed operation. Inspect retained run records and restore the independently reviewed application, or review a new launch. Keep partial output and do not resume it automatically.',
  'read-selection': 'Frozen preparation selection cannot be read under its recorded byte identity and extent. Restore the original task40 artifact, or explicitly reopen that selection rather than substituting parents.',
  'read-support': 'A preparation supporting file is absent, changed, outside its declared root or beyond the authorized byte allowance. Restore the exact referenced files or review a new input contract before retrying.',
  'write-output': 'Preparation input output could not be written exclusively and synchronized. Keep the partial run for diagnosis and use a new private run directory; never overwrite or resume it automatically.',
};

/**
 * Controlled CLI refusal reports operation and locator without retaining input-bearing exception causes.
 *
 * @example
 * ```ts
 * throw new ProducerInputRunError({ operation: 'read-support', locator: reference.path });
 * ```
 */
export class ProducerInputRunError extends Error {
  /**
   * CLI forwarding may retain this authored message and encoded locator.
   */
  readonly messageNamesOnly: true = true;
  /**
   * Failed operation determines the available recovery paths.
   */
  readonly operation: ProducerInputOperation;

  /**
   * Builds a refusal from closed operation vocabulary and an optional file or run locator.
   *
   * @param operation - failed runner operation, not a qualification verdict
   *
   * @param locator - affected input name, never its contents
   *
   * @example
   * ```ts
   * const error = new ProducerInputRunError({ operation: 'read-selection', locator: selectionPath });
   * ```
   */
  constructor({
    operation,
    locator
  }: {
    readonly operation: ProducerInputOperation;
    readonly locator?: string;
  }) {
    super(`${INPUT_RUN_MESSAGES[operation]}${locator === undefined ? '' : ` Input: ${JSON.stringify(locator)}.`}`);
    this.name = 'ProducerInputRunError';
    this.operation = operation;
  }
}

//endregion Names-only preparation input runner failures
