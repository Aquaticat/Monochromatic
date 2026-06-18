/**
 * Model-visible response format helpers for Pi Linkup tool output.
 *
 * @module
 */

//region Constants

/**
 * JSON response temp filename.
 */
const TEMP_JSON_FILENAME = 'response.json';

/**
 * JSONL response temp filename.
 */
const TEMP_JSONL_FILENAME = 'response.jsonl';

/**
 * Plain response temp filename.
 */
const TEMP_TEXT_FILENAME = 'response.txt';

/**
 * Pretty JSON indentation width.
 */
const JSON_INDENT_SPACES = 2;

/**
 * Single-field Linkup markdown response key.
 */
const MARKDOWN_RESPONSE_KEY = 'markdown' as const;

/**
 * Single-field Linkup search results response key.
 */
const RESULTS_RESPONSE_KEY = 'results' as const;

/**
 * Sentinel used when a response is not exactly one markdown field.
 */
const NOT_MARKDOWN_ONLY_RESPONSE: unique symbol = Symbol('not a markdown-only Linkup response',);

/**
 * Sentinel used when a response is not exactly one results array field.
 */
const NOT_RESULTS_ARRAY_RESPONSE: unique symbol = Symbol('not a results-array Linkup response',);

/**
 * Truncation label for model-visible JSON output.
 */
const JSON_TRUNCATION_LABEL = 'JSON response';

/**
 * Truncation label for model-visible JSONL output.
 */
const JSONL_TRUNCATION_LABEL = 'JSONL response';

/**
 * Truncation label for model-visible plain response output.
 */
const PLAIN_TRUNCATION_LABEL = 'Linkup response';

//endregion Constants

//region Types

/**
 * Options controlling model-visible response text creation.
 */
type ModelTextForLinkupResponseOptions = {
  /**
   * Linkup response value to render.
   */
  readonly value: unknown;
  /**
   * Whether exact single-field results arrays should render as JSONL.
   */
  readonly renderResultsArrayAsJsonl: boolean;
};

/**
 * Model-visible response text plus truncation metadata.
 */
type ModelTextForLinkupResponseResult = {
  /**
   * Text visible to the model before truncation.
   */
  readonly text: string;
  /**
   * Temp filename matching response text format.
   */
  readonly tempFilename: string;
  /**
   * Label used in truncation notices.
   */
  readonly truncationLabel: string;
};

/**
 * Model text extracted from a markdown-only response, or sentinel for every other shape.
 */
type MarkdownOnlyResponseText = string | typeof NOT_MARKDOWN_ONLY_RESPONSE;

/**
 * Model text extracted from a single-field results array response, or sentinel for every other shape.
 */
type ResultsArrayJsonlResponseText = string | typeof NOT_RESULTS_ARRAY_RESPONSE;

//endregion Types

//region Public API

/**
 * Return model-visible text for a Linkup response value.
 *
 * @param options - response value and output format controls
 *
 * @returns model-visible text, temp filename, and truncation label
 *
 * @example
 * ```ts
 * modelTextForLinkupResponse({ value: { markdown: '# Meow' }, renderResultsArrayAsJsonl: false });
 * ```
 */
function modelTextForLinkupResponse(
  options: ModelTextForLinkupResponseOptions,
): ModelTextForLinkupResponseResult {
  /**
   * Markdown response text, when value is exactly a markdown-only response.
   */
  const markdownText = markdownOnlyResponseText(options.value,);
  if ((typeof markdownText) === 'string')
    return {
      text: markdownText,
      tempFilename: TEMP_TEXT_FILENAME,
      truncationLabel: PLAIN_TRUNCATION_LABEL,
    };

  if (options.renderResultsArrayAsJsonl) {
    /**
     * JSONL response text, when value is exactly a results-array response.
     */
    const jsonlText = resultsArrayJsonlText(options.value,);
    if ((typeof jsonlText) === 'string')
      return {
        text: jsonlText,
        tempFilename: TEMP_JSONL_FILENAME,
        truncationLabel: JSONL_TRUNCATION_LABEL,
      };
  }

  return {
    text: stringifyJsonForModel(options.value,),
    tempFilename: TEMP_JSON_FILENAME,
    truncationLabel: JSON_TRUNCATION_LABEL,
  };
}

//endregion Public API

//region Helpers

/**
 * Extract markdown text from exact single-field markdown Linkup responses.
 *
 * @param value - Linkup response value
 *
 * @returns markdown text when value has only a string markdown property
 *
 * @example
 * ```ts
 * markdownOnlyResponseText({ markdown: '# Meow' });
 * ```
 */
function markdownOnlyResponseText(value: unknown,): MarkdownOnlyResponseText {
  if (value === null)
    return NOT_MARKDOWN_ONLY_RESPONSE;

  if ((typeof value) !== 'object')
    return NOT_MARKDOWN_ONLY_RESPONSE;

  if (Array.isArray(value,))
    return NOT_MARKDOWN_ONLY_RESPONSE;

  /**
   * Own enumerable response keys.
   */
  const keys = Object.keys(value,);
  if ((keys.length !== 1) || (keys[0] !== MARKDOWN_RESPONSE_KEY))
    return NOT_MARKDOWN_ONLY_RESPONSE;

  if (!hasMarkdownResponseProperty(value,))
    return NOT_MARKDOWN_ONLY_RESPONSE;

  /**
   * Markdown property value.
   */
  const { markdown, } = value;
  return ((typeof markdown) === 'string')
    ? markdown
    : NOT_MARKDOWN_ONLY_RESPONSE;
}

/**
 * Extract JSONL text from exact single-field results-array Linkup responses.
 *
 * @param value - Linkup response value
 *
 * @returns JSONL text when value has only an array results property
 *
 * @example
 * ```ts
 * resultsArrayJsonlText({ results: [{ title: 'Meow' }] });
 * ```
 */
function resultsArrayJsonlText(value: unknown,): ResultsArrayJsonlResponseText {
  if (!isRecord(value,))
    return NOT_RESULTS_ARRAY_RESPONSE;

  /**
   * Own enumerable response keys.
   */
  const keys = Object.keys(value,);
  if ((keys.length !== 1) || (keys[0] !== RESULTS_RESPONSE_KEY))
    return NOT_RESULTS_ARRAY_RESPONSE;

  if (!hasResultsResponseProperty(value,))
    return NOT_RESULTS_ARRAY_RESPONSE;

  /**
   * Results property value.
   */
  const { results, } = value;
  if (!Array.isArray(results,))
    return NOT_RESULTS_ARRAY_RESPONSE;

  /**
   * Results array items before object-shape validation.
   */
  const resultItems: readonly unknown[] = results;
  if (!resultItems.every(isRecord,))
    return NOT_RESULTS_ARRAY_RESPONSE;

  return resultItems
    .map(function stringifyResult(result,) {
      return stringifyJsonLineForModel(result,);
    },)
    .join('\n',);
}

/**
 * Return whether object exposes a markdown response property.
 *
 * @param value - object response value
 *
 * @returns whether object has a markdown property readable as unknown
 *
 * @example
 * ```ts
 * hasMarkdownResponseProperty({ markdown: '# Meow' });
 * ```
 */
function hasMarkdownResponseProperty(value: object,): value is { readonly markdown: unknown; } {
  return MARKDOWN_RESPONSE_KEY in value;
}

/**
 * Return whether object exposes a results response property.
 *
 * @param value - object response value
 *
 * @returns whether object has a results property readable as unknown
 *
 * @example
 * ```ts
 * hasResultsResponseProperty({ results: [] });
 * ```
 */
function hasResultsResponseProperty(value: object,): value is { readonly results: unknown; } {
  return RESULTS_RESPONSE_KEY in value;
}

/**
 * Return whether value is a non-null object record.
 *
 * @param value - unknown value
 *
 * @returns whether value can be read by string keys
 *
 * @example
 * ```ts
 * isRecord({});
 * ```
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

/**
 * JSON-stringify a value for model-visible content.
 *
 * @param value - value to serialize
 *
 * @returns pretty JSON text, or JSON null when value is undefined
 */
function stringifyJsonForModel(value: unknown,): string {
  /**
   * JSON string output.
   */
  const json = JSON.stringify(
    value,
    null,
    JSON_INDENT_SPACES,
  );
  return json ?? 'null';
}

/**
 * JSON-stringify a single JSONL item for model-visible content.
 *
 * @param value - object value to serialize
 *
 * @returns compact JSON text for one JSONL line
 */
function stringifyJsonLineForModel(value: Record<string, unknown>,): string {
  /**
   * JSON line output.
   */
  const json = JSON.stringify(value,);
  return json ?? 'null';
}

//endregion Helpers

export { modelTextForLinkupResponse, };
export type {
  ModelTextForLinkupResponseOptions,
  ModelTextForLinkupResponseResult,
};
