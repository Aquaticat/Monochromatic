/**
 Native resource snapshots detach instruction text while preserving opaque constructor dependencies.

 @module
 */
import type { ResourceLoader } from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { SourceCollectionError } from '../errors.ts';
import { recordResourceInputCopy } from './diagnostics.ts';
import {
  readInputData,
  requireInputFields,
  requireInputList,
  requireInputRecord,
  requireInputText
} from './input-shape.ts';

//region Resource input snapshots retain the original schema and byte limits

/**
 Maximum context file entries admitted by the original resource profile.
 */
const MAX_CONTEXT_FILES = 64;
/**
 Maximum appended prompt entries admitted by the original resource profile.
 */
const MAX_APPEND_TEXTS = 32;
/**
 Complete snapshots retain the original serialized byte ceiling.
 */
const MAX_SNAPSHOT_BYTES = 524_288;
/**
 Copy diagnostics identify the native resource boundary.
 */
const l = tagged({ tag: 'auto-mode-native-resource-input' });

/**
 Original context snapshots retain detached file text and path metadata.
 */
export type ResourceContextSnapshot = {
  /**
   Context files preserve their original order.
   */
  readonly agentsFiles: readonly {
    /**
     Original path is metadata and confers no authority.
     */
    readonly path: string;
    /**
     Complete captured file text.
     */
    readonly content: string;
  }[];
};

/**
 Supported source values remain distinct, including an absent system prompt.
 */
export type ResourceInputSnapshot = ResourceContextSnapshot | readonly string[] | ReturnType<ResourceLoader['getSystemPrompt']>;

/**
 Copy one original context file without retaining borrowed mutable content.

 @param file - original context-file input

 @returns detached immutable text and path metadata

 @throws SourceCollectionError when the file differs from the native input schema
 */
function copyContextFile(file: unknown): ResourceContextSnapshot['agentsFiles'][number] {
  /**
   Original field validation precedes reading either text value.
   */
  const record = requireInputFields({
    value: file,
    keys: [
      'path',
      'content'
    ],
    label: 'Context file'
  });
  return Object.freeze({
    path: requireInputText({
      value: record.path,
      label: 'Context file path'
    }),
    content: requireInputText({
      value: record.content,
      label: 'Context file content'
    }),
  });
}

/**
 Select the original resource schema before copying its instruction-bearing values.

 @param kind - native context, system, or append boundary

 @param value - original input whose supported shape must be established

 @returns detached snapshot without introducing permission or source authority

 @throws SourceCollectionError when kind or input is outside the native resource profile
 */
function copyResourceInput({
  kind,
  value
}: {
  readonly kind: string;
  readonly value: unknown;
}): ResourceInputSnapshot {
  if (kind === 'context') {
    /**
     Context has one original field; hidden additions remain rejected.
     */
    const record = requireInputFields({
      value,
      keys: ['agentsFiles'],
      label: 'Context input'
    });
    /**
     List validation retains every original descriptor check before copying.
     */
    const files = requireInputList({
      value: record.agentsFiles,
      label: 'Context files',
      maximum: MAX_CONTEXT_FILES
    });
    return Object.freeze({ agentsFiles: Object.freeze(files.map(copyContextFile)) });
  }
  if (kind === 'system') return value === undefined ? undefined : requireInputText({
    value,
    label: 'System input'
  });
  if (kind === 'append') {
    /**
     Append order remains the original loader's order.
     */
    const entries = requireInputList({
      value,
      label: 'Append input',
      maximum: MAX_APPEND_TEXTS
    });
    return Object.freeze(entries.map(function copyAppendText(entry) {
      return requireInputText({
        value: entry,
        label: 'Append text'
      });
    }));
  }
  throw new SourceCollectionError('Unknown resource input kind');
}

/**
 Copy inputs before callbacks and results after callbacks without retaining borrowed mutable text.

 @param kind - original native resource boundary

 @param value - complete native input to validate and detach

 @returns immutable snapshot within the original complete-input byte budget

 @throws SourceCollectionError when shape or total bytes exceed the original profile

 @example
 ```ts
 snapshotInput({ kind: 'context', value: { agentsFiles: [{ path: 'AGENTS.md', content: 'original' }] } });
 ```
 */
export function snapshotInput({
  kind,
  value
}: {
  readonly kind: string;
  readonly value: unknown;
}): ResourceInputSnapshot {
  /**
   Count every attempted copy without retaining a sink write for each synchronous freshness check.
   */
  recordResourceInputCopy(kind);
  /**
   The entire copied source enters the original aggregate budget.
   */
  const copy = copyResourceInput({
    kind,
    value
  });
  if (Buffer.byteLength(JSON.stringify({ value: copy })) > MAX_SNAPSHOT_BYTES) throw new SourceCollectionError('Resource input exceeds total byte bound');
  return copy;
}

//endregion Resource input snapshots retain the original schema and byte limits

//region Constructor options preserve opaque dependency identity and detach appended text

/**
 Copy constructor options without invoking accessors while selecting opaque native dependencies.

 @param options - original loader constructor options

 @returns owned option record retaining opaque values and copying appended source text

 @throws SourceCollectionError when options are not named enumerable own data fields

 @example
 ```ts
 copyOptions({ cwd: '/workspace', appendSystemPrompt: ['original'] });
 ```
 */
export function copyOptions(options: unknown): Record<string, unknown> {
  /**
   Entry diagnostics distinguish constructor selection from source snapshots.
   */
  const rl = tagged({
    tag: copyOptions.name,
    l
  });
  rl.debug('copying native loader constructor options');
  /**
   The ordinary record check allows the original null-prototype option shape.
   */
  const record = requireInputRecord({
    value: options,
    message: 'Loader options require an ordinary record'
  });
  /**
   This new object owns every selected field without freezing borrowed dependencies.
   */
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(record)) {
    if (((typeof key) !== 'string') || (key === '__proto__')) throw new SourceCollectionError('Loader options require named data properties');
    result[key] = readInputData({
      value: record,
      key,
      message: 'Loader options require named data properties'
    });
  }
  if (result.appendSystemPrompt !== undefined) result.appendSystemPrompt = snapshotInput({
    kind: 'append',
    value: result.appendSystemPrompt
  });
  return result;
}

//endregion Constructor options preserve opaque dependency identity and detach appended text
