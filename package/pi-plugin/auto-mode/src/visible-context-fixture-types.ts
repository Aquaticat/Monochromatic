/** Disposable session shapes include old and future transcript entries. @module */
import {VERDICT_ENTRY_TYPE,type VerdictData} from '../dist/final/node/index.mjs';

//region Nonstandard fixture entries exercise the original Pi projector.
/** Text block shape consumed by {@link buildContext}. */
type MockTextBlock = {
  /** Message block discriminator. */
  readonly type: 'text';
  /** Text payload. */
  readonly text: string;
};

/** Image block shape consumed by {@link buildContext}. */
type MockImageBlock = {
  /** Message block discriminator. */
  readonly type: 'image';
  /** Complete encoded image data. */
  readonly data: string;
  /** Image media type. */
  readonly mimeType: string;
};

/** Thinking block shape consumed by {@link buildContext}. */
type MockThinkingBlock = {
  /** Assistant block discriminator. */
  readonly type: 'thinking';
  /** Complete visible reasoning text. */
  readonly thinking: string;
  /** Provider-only signature that judge context must omit. */
  readonly thinkingSignature?: string;
};

/** Tool-call block shape consumed by {@link buildContext}. */
type MockToolCallBlock = {
  /** Assistant block discriminator. */
  readonly type: 'toolCall';
  /** Tool-call identifier. */
  readonly id?: string;
  /** Tool name. */
  readonly name: string;
  /** Tool arguments. */
  readonly arguments: Readonly<Record<string, unknown>>;
  /** Provider-only signature that judge context must omit. */
  readonly thoughtSignature?: string;
};

/** Message shapes used by the context scanner. */
type MockMessage =
  | {
    /** User-message role. */
    readonly role: 'user';
    /** User content. */
    readonly content: string | readonly (MockTextBlock | MockImageBlock)[];
  }
  | {
    /** Assistant-message role. */
    readonly role: 'assistant';
    /** Assistant visible blocks. */
    readonly content: readonly (MockTextBlock | MockThinkingBlock | MockToolCallBlock)[];
    /** Assistant stop reason. */
    readonly stopReason?: string;
    /** Visible assistant error text. */
    readonly errorMessage?: string;
  }
  | {
    /** Tool-result role. */
    readonly role: 'toolResult';
    /** Tool-call identifier. */
    readonly toolCallId?: string;
    /** Tool name reported by Pi. */
    readonly toolName: string;
    /** Whether tool execution errored. */
    readonly isError: boolean;
    /** Tool result content. */
    readonly content: readonly (MockTextBlock | MockImageBlock)[];
    /** Renderer-visible tool details. */
    readonly details?: unknown;
  }
  | {
    /** Direct Bash execution role. */
    readonly role: 'bashExecution';
    /** Executed command. */
    readonly command: string;
    /** Complete command output. */
    readonly output: string;
    /** Process exit status. */
    readonly exitCode?: number;
    /** Cancellation state. */
    readonly cancelled: boolean;
    /** Output truncation state. */
    readonly truncated: boolean;
    /** Full output path shown by Pi when output is truncated. */
    readonly fullOutputPath?: string;
  }
  | {
    /** Persisted system-prompt role that Pi does not render. */
    readonly role: 'system';
    /** Instruction text. */
    readonly content: string;
    /** Named prompt sections. */
    readonly sections?: Readonly<Record<string, string>>;
    /** Session timestamp consumed by Pi projection. */
    readonly timestamp: number;
  }
  | {
    /** Role from a newer Pi runtime than installed declarations describe. */
    readonly role: 'futureRole';
    /** Payload whose visibility auto-mode cannot know. */
    readonly payload: string;
  }
  | {
    /** User-message role as parsed from an older or hand-edited session file. */
    readonly role: 'user';
    /** Missing content that Pi's projection normalizes. */
    readonly content: null;
  };

/** Branch-entry shapes used by the context scanner. */
export type MockBranchEntry =
  | {
    /** Session entry discriminator. */
    readonly type: 'message';
    /** Session message. */
    readonly message: MockMessage;
  }
  | {
    /** Session custom entry discriminator. */
    readonly type: 'custom';
    /** Extension custom entry discriminator. */
    readonly customType: typeof VERDICT_ENTRY_TYPE;
    /** Verdict data attached to next tool result. */
    readonly data: VerdictData;
  }
  | {
    /** Visible custom-message entry discriminator. */
    readonly type: 'custom_message';
    /** Custom renderer identity. */
    readonly customType: string;
    /** Complete custom content. */
    readonly content: string | readonly (MockTextBlock | MockImageBlock)[];
    /** Renderer-visible details. */
    readonly details?: unknown;
    /** Whether Pi displays message. */
    readonly display: boolean;
    /** Session timestamp consumed by Pi projection. */
    readonly timestamp: string;
  }
  | {
    /** Compaction entry discriminator. */
    readonly type: 'compaction';
    /** Complete compaction summary. */
    readonly summary: string;
    /** First retained session entry identifier. */
    readonly firstKeptEntryId: string;
    /** Token count represented by summary. */
    readonly tokensBefore: number;
    /** System prompt state Pi 0.87 re-emits after compaction. */
    readonly systemMessage?: MockMessage;
    /** Session timestamp consumed by Pi projection. */
    readonly timestamp: string;
  }
  | {
    /** Branch-summary entry discriminator. */
    readonly type: 'branch_summary';
    /** Source branch entry identifier. */
    readonly fromId: string;
    /** Complete branch summary. */
    readonly summary: string;
    /** Session timestamp consumed by Pi projection. */
    readonly timestamp: string;
  };

//endregion
