/**
 * Tool-result content helpers for Pi Linkup.
 *
 * @module
 */

import { randomBytes, } from 'node:crypto';
import {
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  withFileMutationQueue,
  type AgentToolResult,
  type TruncationOptions,
  type TruncationResult,
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { linkupLogger, } from './log.ts';

//region Constants

/**
 * Prefix used for temp directories that hold full JSON output.
 */
const TEMP_DIR_PREFIX = 'pi-linkup-json-';

/**
 * JSON response temp filename.
 */
const TEMP_JSON_FILENAME = 'response.json';

/**
 * Number of random bytes added to temp directory prefix.
 */
const TEMP_RANDOM_BYTES = 4;

/**
 * Pretty JSON indentation width.
 */
const JSON_INDENT_SPACES = 2;

/**
 * Single-field Linkup markdown response key.
 */
const MARKDOWN_RESPONSE_KEY = 'markdown' as const;

/**
 * Sentinel used when a response is not exactly one markdown field.
 */
const NOT_MARKDOWN_ONLY_RESPONSE: unique symbol = Symbol('not a markdown-only Linkup response',);

/**
 * Bytes in one kibibyte, matching Pi's byte-limit size formatting.
 */
const BYTES_PER_KIBIBYTE = 1_024;

/**
 * Linkup response JSON kibibytes visible to the model before temp-file fallback.
 */
const LINKUP_VISIBLE_JSON_MAX_KIBIBYTES = 100;

/**
 * Linkup response JSON bytes visible to the model before temp-file fallback.
 */
const LINKUP_VISIBLE_JSON_MAX_BYTES: number = LINKUP_VISIBLE_JSON_MAX_KIBIBYTES * BYTES_PER_KIBIBYTE;

//endregion Constants

//region Types

/**
 * Text content item returned by a Pi tool.
 */
type TextContentItem = {
  /**
   * Content item type.
   */
  readonly type: 'text';
  /**
   * Text visible to the model.
   */
  readonly text: string;
};

/**
 * Details stored by Linkup tool results.
 */
type LinkupToolDetails = {
  /**
   * Model-visible Linkup-shaped response.
   */
  readonly linkupResponse: unknown;
  /**
   * Untouched upstream Linkup response.
   */
  readonly rawLinkupResponse: unknown;
  /**
   * Ignored compatibility keys, when supplied.
   */
  readonly ignoredKeys?: readonly string[];
  /**
   * Blocked search result URLs removed locally, when any were removed.
   */
  readonly removedBlockedUrls?: readonly string[];
  /**
   * Full JSON temp-file path, when visible JSON was truncated.
   */
  readonly fullJsonPath?: string;
  /**
   * Truncation metadata, when visible JSON was truncated.
   */
  readonly truncation?: TruncationResult;
};

/**
 * Options for creating JSON content items.
 */
type JsonContentOptions = {
  /**
   * Linkup response value to render.
   */
  readonly value: unknown;
  /**
   * Optional truncation limits, primarily for tests.
   */
  readonly truncationOptions?: Readonly<TruncationOptions>;
};

/**
 * JSON content item plus temp-file metadata.
 */
type JsonContentResult = {
  /**
   * Text content item visible to the model.
   */
  readonly content: TextContentItem;
  /**
   * Full JSON temp-file path when truncation occurred.
   */
  readonly fullJsonPath?: string;
  /**
   * Truncation metadata when truncation occurred.
   */
  readonly truncation?: TruncationResult;
};

/**
 * Options for warning content text.
 */
type WarningContentOptions = {
  /**
   * Tool name reporting ignored keys.
   */
  readonly toolName: string;
  /**
   * Ignored compatibility keys.
   */
  readonly ignoredKeys: readonly string[];
  /**
   * Fixed behavior explanation.
   */
  readonly fixedBehavior: string;
};

/**
 * Options for full Linkup tool output.
 */
type LinkupToolOutputOptions = {
  /**
   * Tool name reporting warnings.
   */
  readonly toolName: string;
  /**
   * Model-visible response object.
   */
  readonly linkupResponse: unknown;
  /**
   * Untouched upstream Linkup response object.
   */
  readonly rawLinkupResponse: unknown;
  /**
   * Ignored compatibility keys.
   */
  readonly ignoredKeys: readonly string[];
  /**
   * Fixed behavior explanation for ignored-key warning.
   */
  readonly fixedBehavior: string;
  /**
   * Blocked search result URLs removed locally.
   */
  readonly removedBlockedUrls?: readonly string[];
};

/**
 * Model text extracted from a markdown-only response, or sentinel for every other shape.
 */
type MarkdownOnlyResponseText = string | typeof NOT_MARKDOWN_ONLY_RESPONSE;

//endregion Types

/**
 * Module logger.
 */
const l = tagged({
  tag: 'tool-output',
  l: linkupLogger,
},);

//region Public API

/**
 * Create complete Linkup tool output with optional ignored-key warning.
 *
 * @param options - response, raw response, and warning metadata
 *
 * @returns Pi tool result with JSON response content and structured details
 *
 * @example
 * ```ts
 * await createLinkupToolOutput({
 *   toolName: 'linkup_web_search',
 *   linkupResponse: { results: [] },
 *   rawLinkupResponse: { results: [] },
 *   ignoredKeys: [],
 *   fixedBehavior: 'This extension always uses fixed search behavior.',
 * });
 * ```
 */
async function createLinkupToolOutput(
  options: LinkupToolOutputOptions,
): Promise<AgentToolResult<LinkupToolDetails>> {
  /**
   * Model-visible content item and truncation metadata.
   */
  const modelContent = await createJsonContent({
    value: options.linkupResponse,
  },);
  /**
   * Warning content item, when compatibility keys were ignored.
   */
  const warningContent = options.ignoredKeys
    .length
    === 0
    ? undefined
    : createWarningContent({
      toolName: options.toolName,
      ignoredKeys: options.ignoredKeys,
      fixedBehavior: options.fixedBehavior,
    },);
  /**
   * Model-visible content items in final result order.
   */
  const content = warningContent === undefined
    ? [modelContent.content,]
    : [
      warningContent,
      modelContent.content,
    ];

  return {
    content,
    details: {
      linkupResponse: options.linkupResponse,
      rawLinkupResponse: options.rawLinkupResponse,
      ...(options.ignoredKeys
        .length
        === 0 ? {} : { ignoredKeys: options.ignoredKeys, }),
      ...((options.removedBlockedUrls === undefined) || (options.removedBlockedUrls
        .length
        === 0)
        ? {}
        : { removedBlockedUrls: options.removedBlockedUrls, }),
      ...(modelContent.fullJsonPath === undefined ? {} : { fullJsonPath: modelContent.fullJsonPath, }),
      ...(modelContent.truncation === undefined ? {} : { truncation: modelContent.truncation, }),
    },
  };
}

/**
 * Create a model-visible text content item, truncating and writing full JSON to temp when needed.
 *
 * @param options - value and optional truncation limits
 *
 * @returns content item and truncation metadata
 *
 * @example
 * ```ts
 * await createJsonContent({ value: { ok: true } });
 * ```
 */
async function createJsonContent(options: JsonContentOptions,): Promise<JsonContentResult> {
  /**
   * Model-visible response text.
   */
  const contentText = modelTextForLinkupResponse(options.value,);
  /**
   * Truncation result using Linkup byte cap and Pi line cap unless tests override limits.
   */
  const truncation = truncateHead(
    contentText,
    {
      maxLines: options.truncationOptions
        ?.maxLines
        ?? DEFAULT_MAX_LINES,
      maxBytes: options.truncationOptions
        ?.maxBytes
        ?? LINKUP_VISIBLE_JSON_MAX_BYTES,
    },
  );
  if (!truncation.truncated)
    return {
      content: {
        type: 'text',
        text: truncation.content,
      },
    };

  /**
   * Temp file path containing the full JSON response.
   */
  const fullJsonPath = await writeFullJsonToTemp(stringifyJsonForModel(options.value,),);
  /**
   * Visible text with truncation notice appended.
   */
  const visibleText = [
    truncation.content,
    `[JSON response truncated: showing ${String(truncation.outputLines,)} of ${String(truncation.totalLines,)} lines (${formatSize(truncation.outputBytes,)} of ${formatSize(truncation.totalBytes,)}). Full JSON response saved to: ${fullJsonPath}]`,
  ].join('\n\n',);

  l.warn(`truncated Linkup JSON response; full response at ${fullJsonPath}`,);
  return {
    content: {
      type: 'text',
      text: visibleText,
    },
    fullJsonPath,
    truncation,
  };
}

/**
 * Create model-visible warning for ignored compatibility keys.
 *
 * @param options - tool name, ignored keys, and fixed behavior text
 *
 * @returns warning text content item
 *
 * @example
 * ```ts
 * createWarningContent({ toolName: 'linkup_web_search', ignoredKeys: ['depth'], fixedBehavior: 'Fixed.' });
 * ```
 */
function createWarningContent(options: WarningContentOptions,): TextContentItem {
  return {
    type: 'text',
    text: [
      `Warning: ignored extension-unsupported ${options.toolName} parameters: ${options.ignoredKeys
        .join(', ',)}.`,
      options.fixedBehavior,
    ].join('\n',),
  };
}

//endregion Public API

//region Helpers

/**
 * Return model-visible text for a Linkup response value.
 *
 * @param value - Linkup response value
 *
 * @returns markdown text for single-field markdown responses, otherwise pretty JSON
 *
 * @example
 * ```ts
 * modelTextForLinkupResponse({ markdown: '# Meow' });
 * ```
 */
function modelTextForLinkupResponse(value: unknown,): string {
  /**
   * Markdown response text, when value is exactly a markdown-only response.
   */
  const markdownText = markdownOnlyResponseText(value,);
  if ((typeof markdownText) === 'string')
    return markdownText;

  return stringifyJsonForModel(value,);
}

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
 * Write full JSON text to a temp file.
 *
 * @param jsonText - full JSON text
 *
 * @returns temp file path
 */
async function writeFullJsonToTemp(jsonText: string,): Promise<string> {
  /**
   * Random suffix to avoid temp directory collisions.
   */
  const randomSuffix = randomBytes(TEMP_RANDOM_BYTES,)
    .toString('hex',);
  /**
   * Temp directory dedicated to this response.
   */
  const tempDir = await mkdtemp(join(
    tmpdir(),
    `${TEMP_DIR_PREFIX}${randomSuffix}-`,
  ),);
  /**
   * Temp file path storing full JSON response.
   */
  const tempFile = join(
    tempDir,
    TEMP_JSON_FILENAME,
  );
  await withFileMutationQueue(
    tempFile,
    async function writeQueuedJson() {
    await writeFile(
      tempFile,
      jsonText,
      'utf8',
    );
  },
  );
  return tempFile;
}

//endregion Helpers

export {
  createJsonContent,
  createLinkupToolOutput,
  createWarningContent,
  LINKUP_VISIBLE_JSON_MAX_BYTES,
};
export type {
  JsonContentResult,
  LinkupToolDetails,
  LinkupToolOutputOptions,
  TextContentItem,
  WarningContentOptions,
};
