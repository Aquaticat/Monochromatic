//region Non-serving provider request capture diagnostics

/**
 * Fixed capture outcomes, including the private identity-compared transport stop.
 * @example
 * ```ts
 * const kind: PreparationRequestCaptureFailure = 'ledger';
 * ```
 */
export type PreparationRequestCaptureFailure = 'captured' | 'request' | 'no-route' | 'no-capture' | 'ledger' | 'timeout';

/** Diagnostics contain no request text, headers, account data or arbitrary model identifier. */
const CAPTURE_MESSAGES: Readonly<Record<PreparationRequestCaptureFailure, string>> = {
  captured: 'Preparation provider request captured before transmission.',
  request: 'Preparation capture encountered an unsupported request operation, missing body or forbidden generation control. Inspect the compiled provider request builder; no request was transmitted.',
  'no-route': 'Preparation capture found no permitted text-serving route for a configured model. Correct the registered electorate or compiled route configuration; do not silently omit the identity.',
  'no-capture': 'Preparation capture did not observe exactly one native provider request. Inspect the native caller and capture adapter before registering an execution plan.',
  ledger: 'Preparation request capture attempted to access a spend ledger. Keep capture before transmission and accounting; never point its non-serving client at real account state.',
  timeout: 'Preparation request capture requires a positive finite native stage timeout. Register the actual exchange timeout before materializing request bodies.',
};

/**
 * Privacy-safe failure for materialization that must never buy a provider response.
 * The captured variant is handled by instance identity inside the capture operation.
 * @example
 * ```ts
 * throw new PreparationRequestCaptureError({ kind: 'request', });
 * ```
 */
export class PreparationRequestCaptureError extends Error {
  /** All diagnostics are fixed operation descriptions. */
  public readonly messageNamesOnly: true = true;
  /** Named materialization boundary, separate from model output quality. */
  public readonly kind: PreparationRequestCaptureFailure;

  /**
   * Creates a fixed request-capture diagnostic without private input interpolation.
   * @param kind - observed capture boundary
   * @example
   * ```ts
   * new PreparationRequestCaptureError({ kind: 'ledger', });
   * ```
   */
  public constructor({ kind, }: { readonly kind: PreparationRequestCaptureFailure; },) {
    super(CAPTURE_MESSAGES[kind],);
    this.name = 'PreparationRequestCaptureError';
    this.kind = kind;
  }
}

//endregion Non-serving provider request capture diagnostics
