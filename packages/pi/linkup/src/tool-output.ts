/**
 * Tool-result content helpers for Pi Linkup.
 *
 * @module
 */

import { randomBytes, } from 'node:crypto';
import { mkdtemp, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import type { AgentToolResult, } from '@earendil-works/pi-coding-agent';
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  withFileMutationQueue,
  type TruncationOptions,
  type TruncationResult,
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { linkupLogger, } from './log.ts';

//region Constants

/** Prefix used for temp directories that hold full JSON output. */
const TEMP_DIR_PREFIX = 'pi-linkup-json-';

/** JSON response temp filename. */
const TEMP_JSON_FILENAME = 'response.json';

/** Number of random bytes added to temp directory prefix. */
const TEMP_RANDOM_BYTES = 4;

/** Pretty JSON indentation width. */
const JSON_INDENT_SPACES = 2;

//endregion Constants

//region Types

/**
 * Text content item returned by a Pi tool.
 */
type TextContentItem = {
  /** Content item type. */
  readonly type: 'text';
  /** Text visible to the model. */
  readonly text: string;
};

/**
 * Details stored by Linkup tool results.
 */
type LinkupToolDetails = {
  /** Model-visible Linkup-shaped response. */
  readonly linkupResponse: unknown;
  /** Untouched upstream Linkup response. */
  readonly rawLinkupResponse: unknown;
  /** Ignored compatibility keys, when supplied. */
  readonly ignoredKeys?: readonly string[];
  /** Blocked search result URLs removed locally, when any were removed. */
  readonly removedBlockedUrls?: readonly string[];
  /** Full JSON temp-file path, when visible JSON was truncated. */
  readonly fullJsonPath?: string;
  /** Truncation metadata, when visible JSON was truncated. */
  readonly truncation?: TruncationResult;
};

/**
 * Options for creating JSON content items.
 */
type JsonContentOptions = {
  /** Value to serialize to JSON. */
  readonly value: unknown;
  /** Optional truncation limits, primarily for tests. */
  readonly truncationOptions?: TruncationOptions;
};

/**
 * JSON content item plus temp-file metadata.
 */
type JsonContentResult = {
  /** Text content item visible to the model. */
  readonly content: TextContentItem;
  /** Full JSON temp-file path when truncation occurred. */
  readonly fullJsonPath?: string;
  /** Truncation metadata when truncation occurred. */
  readonly truncation?: TruncationResult;
};

/**
 * Options for warning content text.
 */
type WarningContentOptions = {
  /** Tool name reporting ignored keys. */
  readonly toolName: string;
  /** Ignored compatibility keys. */
  readonly ignoredKeys: readonly string[];
  /** Fixed behavior explanation. */
  readonly fixedBehavior: string;
};

/**
 * Options for full Linkup tool output.
 */
type LinkupToolOutputOptions = {
  /** Tool name reporting warnings. */
  readonly toolName: string;
  /** Model-visible response object. */
  readonly linkupResponse: unknown;
  /** Untouched upstream Linkup response object. */
  readonly rawLinkupResponse: unknown;
  /** Ignored compatibility keys. */
  readonly ignoredKeys: readonly string[];
  /** Fixed behavior explanation for ignored-key warning. */
  readonly fixedBehavior: string;
  /** Blocked search result URLs removed locally. */
  readonly removedBlockedUrls?: readonly string[];
};

//endregion Types

/** Module logger. */
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
  /** Serialized JSON content item and truncation metadata. */
  const jsonContent = await createJsonContent({
    value: options.linkupResponse,
  },);
  /** Warning content item, when compatibility keys were ignored. */
  const warningContent = options.ignoredKeys.length === 0
    ? undefined
    : createWarningContent({
      toolName: options.toolName,
      ignoredKeys: options.ignoredKeys,
      fixedBehavior: options.fixedBehavior,
    },);
  /** Model-visible content items in final result order. */
  const content = warningContent === undefined
    ? [jsonContent.content,]
    : [warningContent, jsonContent.content,];

  return {
    content,
    details: {
      linkupResponse: options.linkupResponse,
      rawLinkupResponse: options.rawLinkupResponse,
      ...(options.ignoredKeys.length === 0 ? {} : { ignoredKeys: options.ignoredKeys, }),
      ...(options.removedBlockedUrls === undefined || options.removedBlockedUrls.length === 0
        ? {}
        : { removedBlockedUrls: options.removedBlockedUrls, }),
      ...(jsonContent.fullJsonPath === undefined ? {} : { fullJsonPath: jsonContent.fullJsonPath, }),
      ...(jsonContent.truncation === undefined ? {} : { truncation: jsonContent.truncation, }),
    },
  };
}

/**
 * Create a JSON text content item, truncating and writing full JSON to temp when needed.
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
  /** Pretty JSON text. */
  const jsonText = stringifyJsonForModel(options.value,);
  /** Truncation result using Pi defaults unless tests override limits. */
  const truncation = truncateHead(jsonText, {
    maxLines: options.truncationOptions?.maxLines ?? DEFAULT_MAX_LINES,
    maxBytes: options.truncationOptions?.maxBytes ?? DEFAULT_MAX_BYTES,
  },);
  if (!truncation.truncated)
    return {
      content: {
        type: 'text',
        text: truncation.content,
      },
    };

  /** Temp file path containing the full JSON response. */
  const fullJsonPath = await writeFullJsonToTemp(jsonText,);
  /** Visible text with truncation notice appended. */
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
      `Warning: ignored extension-unsupported ${options.toolName} parameters: ${options.ignoredKeys.join(', ',)}.`,
      options.fixedBehavior,
    ].join('\n',),
  };
}

//endregion Public API

//region Helpers

/**
 * JSON-stringify a value for model-visible content.
 *
 * @param value - value to serialize
 *
 * @returns pretty JSON text, or JSON null when value is undefined
 */
function stringifyJsonForModel(value: unknown,): string {
  /** JSON string output. */
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
  /** Random suffix to avoid temp directory collisions. */
  const randomSuffix = randomBytes(TEMP_RANDOM_BYTES,).toString('hex',);
  /** Temp directory dedicated to this response. */
  const tempDir = await mkdtemp(join(
    tmpdir(),
    `${TEMP_DIR_PREFIX}${randomSuffix}-`,
  ),);
  /** Temp file path storing full JSON response. */
  const tempFile = join(
    tempDir,
    TEMP_JSON_FILENAME,
  );
  await withFileMutationQueue(tempFile, async function writeQueuedJson() {
    await writeFile(
      tempFile,
      jsonText,
      'utf8',
    );
  },);
  return tempFile;
}

//endregion Helpers

export {
  createJsonContent,
  createLinkupToolOutput,
  createWarningContent,
};
export type {
  JsonContentResult,
  LinkupToolDetails,
  LinkupToolOutputOptions,
  TextContentItem,
  WarningContentOptions,
};
