/**
 * Lib-type specifiers for `typescript/prefer-readonly-parameter-types`.
 *
 * Lists TypeScript standard-library types whose declared methods aren't
 * marked `readonly` but whose instances are effectively immutable from the
 * consumer's perspective. Used by ./prefer-readonly-parameter-types.ts.
 *
 * @example
 * ```typescript
 * import { libAllowSpecifiers } from './prefer-readonly-parameter-types.allow-lib.ts';
 * ```
 */

/**
 * Specifier object shape (matches tsgolint's `TypeOrValueSpecifier` for
 * `from: 'lib'`). Re-typed locally to avoid pulling in tsgolint internals.
 */
type LibSpecifier = {
  readonly from: 'lib';
  readonly name: readonly string[];
};

/**
 * Lib-type specifiers, grouped by concern.
 */
export const libAllowSpecifiers: readonly LibSpecifier[] = [
  {
    from: 'lib',
    name: [
      'Uint8Array',
      'Uint8ClampedArray',
      'Uint16Array',
      'Uint32Array',
      'Int8Array',
      'Int16Array',
      'Int32Array',
      'Float32Array',
      'Float64Array',
      'BigInt64Array',
      'BigUint64Array',
      'ArrayBuffer',
      'SharedArrayBuffer',
      'DataView',
    ],
  },
  {
    from: 'lib',
    name: [
      // ReadonlyMap / ReadonlySet declare query methods (`get`, `has`,
      // `forEach`) without a `readonly` modifier, so the rule treats them
      // as mutable even though they have no real mutator. Whitelist
      // explicitly rather than enabling `treatMethodsAsReadonly`, which
      // would also pass legitimate Set/Map BFS-accumulator mutations.
      'ReadonlyMap',
      'ReadonlySet',
    ],
  },
  {
    from: 'lib',
    name: [
      // WeakSet, WeakMap, and WeakRef are identity-marker types used for
      // traversal visited-sets, caches, and metadata tagging. Their
      // declared methods (`add`/`delete`/`has`, `set`/`get`/`delete`,
      // `deref`) lack `readonly` modifiers, so the rule flags them as
      // mutable. Forcing immutability (e.g. copy-on-write ReadonlySet)
      // breaks correctness: on a DAG with shared children, per-branch
      // copies permit sibling re-traversal of the same object, causing
      // exponential output (2^(depth+1)-1 lines for depth-N balanced
      // AggregateError). The weak-reference semantics are also the
      // correct default for traversal markers and transient metadata,
      // since they don't artificially extend object lifetimes. See
      // Codex finding "Error DAG formatting can grow exponentially"
      // (commit f354fe3).
      'WeakSet',
      'WeakMap',
      'WeakRef',
    ],
  },
  {
    from: 'lib',
    name: [
      // Promise/Iterable families have method properties (`then`, `catch`,
      // `[Symbol.iterator]`, `next`, `return`, `throw`) that are not marked
      // readonly. Instances are effectively immutable values for consumers.
      'Promise',
      'PromiseLike',
      'Iterable',
      'AsyncIterable',
      'Iterator',
      'AsyncIterator',
      'IterableIterator',
      'AsyncIterableIterator',
      'Generator',
      'AsyncGenerator',
    ],
  },
  {
    from: 'lib',
    name: [
      // Common JS lib types with non-readonly methods or mutable state
      // (Date setters, RegExp lastIndex) routinely passed as parameters.
      'RegExp',
      'RegExpExecArray',
      'RegExpMatchArray',
      'Date',
      'Error',
      'EvalError',
      'RangeError',
      'ReferenceError',
      'SyntaxError',
      'TypeError',
      'URIError',
      'AggregateError',
    ],
  },
  {
    from: 'lib',
    name: [
      'Request',
      'Response',
      'Headers',
      'Body',
      'Blob',
      'FormData',
      'AbortSignal',
      'AbortController',
      'ReadableStream',
      'WritableStream',
      'ReadableStreamDefaultReader',
      'WritableStreamDefaultWriter',
      'URL',
      'URLSearchParams',
      'MessageEvent',
      'MessagePort',
    ],
  },
  {
    from: 'lib',
    name: [
      'EventTarget',
      'Event',
      'KeyboardEvent',
      'MouseEvent',
      'FocusEvent',
      'InputEvent',
      'CustomEvent',
      'PointerEvent',
      'TouchEvent',
      'WheelEvent',
      'DragEvent',
      'ClipboardEvent',
      'ProgressEvent',
      'ErrorEvent',
      'CloseEvent',
      'SubmitEvent',
      'BeforeUnloadEvent',
      'StorageEvent',
      'PopStateEvent',
      'HashChangeEvent',
      'PageTransitionEvent',
      'MediaQueryListEvent',
    ],
  },
  {
    from: 'lib',
    name: [
      'Node',
      'Element',
      'Document',
      'ShadowRoot',
      'DocumentFragment',
      'NodeList',
      'HTMLCollection',
      'DOMTokenList',
      'DOMStringList',
      'Range',
      'Selection',
      'Text',
      'DOMRect',
      'DOMRectReadOnly',
    ],
  },
  {
    from: 'lib',
    name: [
      'HTMLElement',
      'HTMLAnchorElement',
      'HTMLAreaElement',
      'HTMLAudioElement',
      'HTMLBaseElement',
      'HTMLBodyElement',
      'HTMLBRElement',
      'HTMLButtonElement',
      'HTMLCanvasElement',
      'HTMLDataElement',
      'HTMLDataListElement',
      'HTMLDetailsElement',
      'HTMLDialogElement',
      'HTMLDivElement',
      'HTMLEmbedElement',
      'HTMLFieldSetElement',
      'HTMLFormElement',
      'HTMLHeadElement',
      'HTMLHeadingElement',
      'HTMLHRElement',
      'HTMLHtmlElement',
      'HTMLIFrameElement',
      'HTMLImageElement',
      'HTMLInputElement',
      'HTMLLabelElement',
      'HTMLLegendElement',
      'HTMLLIElement',
      'HTMLLinkElement',
      'HTMLMapElement',
      'HTMLMediaElement',
      'HTMLMetaElement',
      'HTMLMeterElement',
      'HTMLObjectElement',
      'HTMLOListElement',
      'HTMLOptGroupElement',
      'HTMLOptionElement',
      'HTMLOutputElement',
      'HTMLParagraphElement',
      'HTMLPictureElement',
      'HTMLPreElement',
      'HTMLProgressElement',
      'HTMLQuoteElement',
      'HTMLScriptElement',
      'HTMLSelectElement',
      'HTMLSlotElement',
      'HTMLSourceElement',
      'HTMLSpanElement',
      'HTMLStyleElement',
      'HTMLTableCaptionElement',
      'HTMLTableCellElement',
      'HTMLTableColElement',
      'HTMLTableElement',
      'HTMLTableRowElement',
      'HTMLTableSectionElement',
      'HTMLTemplateElement',
      'HTMLTextAreaElement',
      'HTMLTimeElement',
      'HTMLTitleElement',
      'HTMLTrackElement',
      'HTMLUListElement',
      'HTMLVideoElement',
      'SVGElement',
      'SVGGraphicsElement',
      'SVGSVGElement',
    ],
  },
  {
    from: 'lib',
    name: [
      'File',
      'FileList',
      'FileReader',
      'FileSystemHandle',
      'FileSystemFileHandle',
      'FileSystemDirectoryHandle',
      'IntersectionObserver',
      'IntersectionObserverEntry',
      'MutationObserver',
      'MutationRecord',
      'ResizeObserver',
      'ResizeObserverEntry',
      'PerformanceObserver',
      'PerformanceEntry',
      'WebSocket',
      'Worker',
      'ServiceWorker',
      'MessageChannel',
      'BroadcastChannel',
      'IDBDatabase',
      'IDBObjectStore',
      'IDBIndex',
      'IDBTransaction',
      'IDBRequest',
      'IDBCursor',
      'IDBKeyRange',
      'CSSStyleDeclaration',
      'CanvasRenderingContext2D',
      'OffscreenCanvas',
      'OffscreenCanvasRenderingContext2D',
      'CSSRule',
      'CSSStyleSheet',
      'MediaQueryList',
    ],
  },
];
