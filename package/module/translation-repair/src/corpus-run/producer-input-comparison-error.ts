import type { LoggerCallbackName, } from '@monochromatic-dev/module-logger/ts';

//region Refusals do not erase fresh input or comparison evidence

/**
 Fixed operation failures distinguish an unusable invocation from a persisted identity mismatch.
 
 @example
 ```ts
 const kind: ProducerInputComparisonFailure = 'mismatch';
 ```
 */
export type ProducerInputComparisonFailure = 'contract' | 'bootstrap' | 'output' | 'mismatch' | 'storage' | 'interruption';

/**
 Diagnostics describe input and retention boundaries without forwarding native causes or corpus text.
 */
const COMPARISON_MESSAGES: Readonly<Record<ProducerInputComparisonFailure, string>> = {
  contract: 'The preparation-input comparison contract cannot be verified. Check the independently recorded launch, bootstrap and reference identities and the authorized host profile; a self-digest does not grant approval.',
  bootstrap: 'The fixed preparation-input bootstrap did not finish successfully. Inspect its retained command, streams and exit record; complete application output may still exist after a lifecycle failure. Do not retry automatically.',
  output: 'The fresh preparation-input run could not be independently verified. Inspect its retained completion, artifact, namespace and lifecycle records before creating any root plan, acquisition attempt or client.',
  mismatch: 'The persisted fresh input artifact differs from the separately supplied reference. The input run and comparison record are retained. Check the reference, frozen selection and support, pinned corpus and runtime; separately review intended changes rather than replacing the reference or redrawing parents automatically.',
  storage: 'A private preparation-input comparison record could not be persisted. Inspect access, available storage and any created namespace or output. Preserve existing files; do not overwrite or resume the namespace automatically.',
  interruption: 'Preparation-input comparison was interrupted or reached its deadline. Any created input and comparison files remain retained; inspect lifecycle and output records before deciding further work.',
};

/**
 Names-only comparison failure is not an acquisition result or a recoverable resume instruction.
 
 @example
 ```ts
 throw new ProducerInputComparisonError({ kind: 'mismatch', directory });
 ```
 */
export class ProducerInputComparisonError extends Error {
  /**
   Only authored operation text and the owned directory locator may be rendered.
   */
  public readonly messageNamesOnly: true = true;
  /**
   Fixed failed boundary, not caller-supplied error prose.
   */
  public readonly kind: ProducerInputComparisonFailure;
  /**
   Created or attempted evidence namespace, never proof of current ownership.
   */
  public readonly directory?: string;
  /**
   Fixed callback names report telemetry degradation without replacing the primary failure or retaining thrown values.
   */
  public readonly loggerCallbackFailures: readonly LoggerCallbackName[];

  /**
   Keeps actionable evidence location without retaining native error messages or causes.
   
   @param kind - fixed failed operation or comparison boundary
   
   @param directory - authorized created or attempted namespace locator, absent before path selection

   @param loggerCallbackFailures - owned fixed-name snapshot from the invoking logger observer
   
   @example
   ```ts
   new ProducerInputComparisonError({ kind: 'bootstrap', directory });
   ```
   */
  public constructor({
    kind,
    directory,
    loggerCallbackFailures = [],
  }: {
    readonly kind: ProducerInputComparisonFailure;
    readonly directory?: string;
    readonly loggerCallbackFailures?: readonly LoggerCallbackName[];
  },) {
    super(directory === undefined ? COMPARISON_MESSAGES[kind]
      : `${COMPARISON_MESSAGES[kind]} Directory: ${JSON.stringify(directory)}.`);
    this.name = 'ProducerInputComparisonError';
    this.kind = kind;
    this.loggerCallbackFailures = Object.freeze([...loggerCallbackFailures]);
    if (directory !== undefined)
      this.directory = directory;
  }
}

//endregion Refusals do not erase fresh input or comparison evidence
