/**
 Validate the non-prose grammar of the original parsed native request. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeRequestDerivationError } from './request-derivation-error.ts';

/**
 Numeric sampling controls cannot contribute independently supplied instruction text.
 */
const numericFields = new Set([
  'max_tokens',
  'max_completion_tokens',
  'temperature',
  'top_p',
  'frequency_penalty',
  'presence_penalty',
  'seed'
]);

/**
 Diagnostics identify unsupported fields without including their values.
 */
const l = tagged({ tag: 'auto-mode-request-derivation-envelope' });

//region Protocol fields remain distinct from instruction-bearing payload fields

/**
 Validate a bounded native text-request profile at the observer's existing JSON parse.
 Unknown fields remain unsupported even when the model estimates that the request contains no instructions.
 
 @param parsed - original observer's parsed request, never a second parse
 
 @param modelId - original selected model identifier
 
 @param messageCount - original native payload's message cardinality before callbacks
 
 @param toolCount - original native payload's tool cardinality before callbacks
 
 @throws NativeRequestDerivationError when an unaccounted protocol field or payload shape is present
 
 @example
 ```ts
 assertRequestDerivationEnvelope({ parsed, modelId, messageCount, toolCount });
 ```
 */
export function assertRequestDerivationEnvelope({
  parsed,
  modelId,
  messageCount,
  toolCount
}: {
  readonly parsed: Readonly<Record<string, unknown>>;
  readonly modelId: string;
  readonly messageCount: number;
  readonly toolCount: number;
}): void {
  /**
   The native observer owns parsing; this check owns supported field coverage.
   */
  const fl = tagged({
    tag: assertRequestDerivationEnvelope.name,
    l
  });
  fl.debug('validating original request protocol fields and native cardinalities');
  if ((parsed.model !== modelId) || (parsed.stream !== true)
    || (!Array.isArray(parsed.messages))
    || (parsed.messages
      .length
      !== messageCount)
    || (messageCount === 0))
    throw new NativeRequestDerivationError('Request derivation requires its original model, stream and native message cardinality');
  if ((parsed.tools === undefined ? 0 : Array.isArray(parsed.tools) ? parsed.tools
    .length : -1) !== toolCount)
    throw new NativeRequestDerivationError('Request tool field differs from its original native cardinality');
  for (const [key, value] of Object.entries(parsed)) {
    if ([
      'model',
      'messages',
      'tools',
      'stream'
    ].includes(key)) continue;
    if (numericFields.has(key) && ((typeof value) === 'number')
      && Number.isFinite(value)) continue;
    if ((key === 'store') && (value === false)) continue;
    if ((key === 'stream_options') && (value !== null)
      && ((typeof value) === 'object')
      && (!Array.isArray(value))
      && (Object.keys(value)
        .length
        === 1)
      && (Reflect.get(
        value,
        'include_usage'
      ) === true)) continue;
    fl.debug(`unsupported original request protocol field: ${key}`);
    throw new NativeRequestDerivationError(`Request field ${key} has no supported native instruction-use derivation`);
  }
}

//endregion Protocol fields remain distinct from instruction-bearing payload fields
