//region Non-serving provider request capture diagnostics

/**
 * Caller-visible failures of non-serving request materialization.
 *
 * @example
 * ```ts
 * const kind: PreparationRequestCaptureFailure = 'ledger';
 * ```
 */
export type PreparationRequestCaptureFailure = 'question' | 'request' | 'no-route' | 'no-capture' | 'ledger' | 'timeout';

/**
 * Diagnostics contain no request text, headers, account data or arbitrary model identifier.
 */
const CAPTURE_MESSAGES: Readonly<Record<PreparationRequestCaptureFailure, string>> = {
  question: 'Preparation parent uses structural dispatch rather than a model question. Retain its structural accounting without registering or buying a pairing call.',
  request: 'Preparation capture encountered an unsupported request operation, invalid JSON body or forbidden top-level generation control. Inspect the compiled provider request builder; no request was transmitted.',
  'no-route': 'Preparation capture found no permitted text-serving route for a configured model. Correct the registered electorate or compiled route configuration; do not silently omit the identity.',
  'no-capture': 'Preparation capture did not observe exactly one native provider request. Inspect the native caller and capture adapter before registering an execution plan.',
  ledger: 'Preparation request capture attempted to access a spend ledger. Keep capture before transmission and accounting; never point its non-serving client at real account state.',
  timeout: 'Preparation request capture requires a positive finite native stage timeout. Register the actual exchange timeout before materializing request bodies.',
};

/**
 * Privacy-safe failure for materialization that must never buy a provider response.
 *
 * @example
 * ```ts
 * throw new PreparationRequestCaptureError({ kind: 'request', });
 * ```
 */
export class PreparationRequestCaptureError extends Error {
  /**
   * All diagnostics are fixed operation descriptions.
   */
  public readonly messageNamesOnly: true = true;
  /**
   * Named materialization boundary, separate from model output quality.
   */
  public readonly kind: PreparationRequestCaptureFailure;

  /**
   * Creates a fixed request-capture diagnostic without private input interpolation.
   *
   * @param kind - observed capture boundary
   *
   * @param cause - underlying parse or capture failure retained without interpolation
   *
   * @example
   * ```ts
   * new PreparationRequestCaptureError({ kind: 'ledger', });
   * ```
   */
  public constructor({
    kind,
    cause,
  }: {
    readonly kind: PreparationRequestCaptureFailure;
    readonly cause?: unknown
  },) {
    super(
      CAPTURE_MESSAGES[kind],
      ...(cause === undefined ? [] : [{ cause, },]),
    );
    this.name = 'PreparationRequestCaptureError';
    this.kind = kind;
  }
}

//endregion Non-serving provider request capture diagnostics
