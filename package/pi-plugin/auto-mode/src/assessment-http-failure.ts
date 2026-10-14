/**
 Reduce bounded provider failure bodies to locally defined diagnostic text.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Only exact recognized codes may cross the provider diagnostic boundary

/**
 Module logger never receives borrowed provider text.
 */
const l = tagged({ tag: 'auto-mode-assessment-http-failure', },);

/**
 Preserve the observed capacity code while withholding all arbitrary upstream content.

 @param raw - bounded response already checked for credential disclosure

 @param status - original HTTP status

 @returns locally defined diagnostic for the original failed request

 @example
 ```ts
 const message = assessmentHttpFailure({ raw: '{}', status: 400 });
 ```
 */
export function assessmentHttpFailure({
  raw,
  status,
}: {
  readonly raw: string;
  readonly status: number;
}): string {
  /**
   Function scope retains the diagnostic boundary in lifecycle logs.
   */
  const rl = tagged({
    tag: assessmentHttpFailure.name,
    l,
  },);
  /**
   Unknown envelopes retain the status-only diagnostic.
   */
  const message = `Assessment request returned HTTP ${status}`;
  rl.debug('classifying bounded provider failure',);
  try {
    /**
     Provider data remains untrusted after JSON decoding.
     */
    const parsed: unknown = JSON.parse(raw,);
    if (((typeof parsed) !== 'object') || (parsed === null)
      || (!('detail' in parsed)))
      return message;
    /**
     Observed provider envelope must contain its own recognized code.
     */
    const { detail, } = parsed;
    if (((typeof detail) !== 'object') || (detail === null)
      || (!('error_type' in detail)))
      return message;
    if (detail.error_type === 'max_tokens_exceeded') {
      rl.debug('recognized provider token capacity failure',);
      return `${message}; provider code max_tokens_exceeded`;
    }
    rl.debug('provider failure has no recognized code',);
    return message;
  }
  catch (error) {
    // Parsing diagnostics can contain response text, so retain only the error category.
    rl.debug(error instanceof SyntaxError
      ? 'provider failure body is not valid JSON'
      : 'provider failure body classification failed',);
    return message;
  }
}

//endregion Only exact recognized codes may cross the provider diagnostic boundary
