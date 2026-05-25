/**
 * Local re-implementations of pi-coding-agent helpers used by morph-compact.
 *
 * The upstream `convertToLlm` and `serializeConversation` are pure
 * transformations with no external runtime deps. Vendoring them here lets the
 * extension treat `@earendil-works/pi-coding-agent` (and its dependency
 * subtree) as a type-only package, so pnpm doesn't have to install
 * `@aws-sdk/client-bedrock-runtime`, `chalk`, `marked`, `cli-highlight`, and
 * the rest of the upstream's runtime closure.
 */

//region Wire-format type definitions

/**
 * Plain text content block in a message. Matches `TextContent` from `pi-ai`'s
 * public types but defined locally so this module does not have to take a
 * direct dependency on `@earendil-works/pi-ai` (which is a transitive of
 * `@earendil-works/pi-coding-agent`, not exposed in morph-compact's
 * `node_modules` under pnpm's isolated linker).
 */
type TextContent = {
  type: 'text';
  text: string;
  textSignature?: string;
};

/**
 * Image content block. Matches `pi-ai`'s `ImageContent`. Image blocks are
 * dropped from the serialized text; Morph Compact runs on text only.
 */
type ImageContent = {
  type: 'image';
  data: string;
  mimeType: string;
};

/**
 * Thinking content block in an assistant message. Matches `pi-ai`'s
 * `ThinkingContent`.
 */
type ThinkingContent = {
  type: 'thinking';
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
};

/**
 * Tool call block in an assistant message. Matches `pi-ai`'s `ToolCall`.
 */
type ToolCall = {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
};

/**
 * User message in LLM-compatible form. Matches `pi-ai`'s `UserMessage`.
 */
type UserMessage = {
  role: 'user';
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
};

/**
 * Assistant message in LLM-compatible form. Loosely matches `pi-ai`'s
 * `AssistantMessage`: fields beyond `role`/`content`/`timestamp` are passed
 * through verbatim by the `convertToLlm` identity branches, so we leave the
 * remainder open as `unknown` to stay forward-compatible with upstream
 * additions.
 */
type AssistantMessage = {
  role: 'assistant';
  content: (TextContent | ThinkingContent | ToolCall)[];
  timestamp: number;
  [extra: string]: unknown;
};

/**
 * Tool-result message in LLM-compatible form. Matches `pi-ai`'s
 * `ToolResultMessage`. Extra fields are passed through.
 */
type ToolResultMessage = {
  role: 'toolResult';
  content: (TextContent | ImageContent)[];
  timestamp: number;
  [extra: string]: unknown;
};

/**
 * Union of LLM-compatible message roles, equivalent to `pi-ai`'s `Message`.
 */
type Message = UserMessage | AssistantMessage | ToolResultMessage;

/**
 * Discriminated union of every `AgentMessage` role this module handles. Wider
 * than `pi-ai`'s `Message`: covers the custom roles pi-coding-agent layers
 * on top via module augmentation (`bashExecution`, `custom`, `branchSummary`,
 * `compactionSummary`).
 */
type AgentMessage =
  | Message
  | BashExecutionAgentMessage
  | CustomAgentMessage
  | BranchSummaryAgentMessage
  | CompactionSummaryAgentMessage;

//endregion

//region Summary text wrappers

/**
 * Prefix prepended to compaction summaries when they reappear as a `user`
 * message in LLM context. Mirrors pi-coding-agent's `COMPACTION_SUMMARY_PREFIX`
 * verbatim so summaries produced here remain interchangeable with summaries
 * produced by pi's default compaction path.
 */
const COMPACTION_SUMMARY_PREFIX =
  'The conversation history before this point was compacted into the following summary:\n\n<summary>\n';

/**
 * Suffix paired with {@link COMPACTION_SUMMARY_PREFIX}. Matches upstream.
 */
const COMPACTION_SUMMARY_SUFFIX = '\n</summary>';

/**
 * Prefix for a branch-summary user message. Matches upstream.
 */
const BRANCH_SUMMARY_PREFIX =
  'The following is a summary of a branch that this conversation came back from:\n\n<summary>\n';

/**
 * Suffix paired with {@link BRANCH_SUMMARY_PREFIX}. Matches upstream.
 */
const BRANCH_SUMMARY_SUFFIX = '</summary>';

/**
 * Maximum characters retained when serializing a `toolResult` content into
 * summary text. Excess characters are truncated with a marker. Matches
 * upstream's `TOOL_RESULT_MAX_CHARS` (2000) so summaries are byte-identical to
 * what pi's default compaction would produce.
 */
const TOOL_RESULT_MAX_CHARS = 2_000;

//endregion

//region BashExecution and tool-result helpers

/**
 * Discriminated shape of a `bashExecution` `AgentMessage`. pi-coding-agent's
 * `core/messages.ts` augments `CustomAgentMessages` with this role, but the
 * concrete interface is not re-exported from the package root. Defining it
 * locally keeps the runtime erased while letting the switch below narrow
 * fields like `command` and `output` without `as any`.
 */
type BashExecutionAgentMessage = {
  role: 'bashExecution';
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  timestamp: number;
  excludeFromContext?: boolean;
};

/**
 * Convert a bash-execution message into the user-visible text shown to the
 * LLM in summarized form.
 *
 * @param msg - the bash execution message
 *
 * @returns formatted multi-line string with command, output, and any
 *   exit-code or truncation annotations
 *
 * @example
 * ```typescript
 * bashExecutionToText({
 *   role: 'bashExecution',
 *   command: 'ls',
 *   output: 'a\\nb',
 *   exitCode: 0,
 *   cancelled: false,
 *   truncated: false,
 *   timestamp: 0,
 * });
 * // 'Ran `ls`\\n```\\na\\nb\\n```'
 * ```
 */
function bashExecutionToText(
  msg: BashExecutionAgentMessage,
): string {
  /** Per-section pieces joined with newlines to produce the final summary text. */
  const sections: string[] = [
    `Ran \`${msg.command}\``,
    (msg.output
      !== '')
      ? `\`\`\`\n${msg.output}\n\`\`\``
      : '(no output)',
  ];
  if (msg.cancelled)
    sections.push('\n(command cancelled)',);
  else if (
    (msg.exitCode
      !== null)
    && (msg.exitCode
      !== undefined)
      && (msg.exitCode
        !== 0)
  ) {
    sections.push(`\nCommand exited with code ${msg.exitCode}`,);
  }
  if (
    msg.truncated
      && (msg.fullOutputPath
        !== undefined)
      && (msg.fullOutputPath
        !== '')
  ) {
    sections.push(`\n[Output truncated. Full output: ${msg.fullOutputPath}]`,);
  }
  return sections.join('\n',);
}

/**
 * Truncate text to the given character budget, appending a notice describing
 * how many characters were dropped.
 *
 * @param text - input text
 *
 * @param maxChars - inclusive maximum length to keep verbatim
 *
 * @returns text unchanged when within budget, otherwise the first `maxChars`
 *   characters followed by `[... N more characters truncated]`
 *
 * @example
 * ```typescript
 * truncateForSummary({ text: 'hello world', maxChars: 5 });
 * // 'hello\\n\\n[... 6 more characters truncated]'
 * ```
 */
function truncateForSummary({
  text,
  maxChars,
}: {
  text: string;
  maxChars: number;
},): string {
  if (text.length
    <= maxChars)
    return text;
  /** Dropped-character count surfaced in the truncation marker. */
  const truncatedChars = text.length
    - maxChars;
  return `${
    text.slice(
      0,
      maxChars,
    )
  }\n\n[... ${truncatedChars} more characters truncated]`;
}

//endregion

//region convertToLlm

/**
 * Discriminated shape of a `custom` `AgentMessage` augmenting role in
 * pi-coding-agent. Mirrors upstream `CustomMessage`.
 */
type CustomAgentMessage = {
  role: 'custom';
  customType: string;
  content: string | (TextContent | ImageContent)[];
  display: boolean;
  details?: unknown;
  timestamp: number;
};

/**
 * Discriminated shape of a `branchSummary` `AgentMessage` augmenting role.
 */
type BranchSummaryAgentMessage = {
  role: 'branchSummary';
  summary: string;
  fromId: string;
  timestamp: number;
};

/**
 * Discriminated shape of a `compactionSummary` `AgentMessage` augmenting
 * role.
 */
type CompactionSummaryAgentMessage = {
  role: 'compactionSummary';
  summary: string;
  tokensBefore: number;
  timestamp: number;
};

/**
 * Map an extended `AgentMessage` (possibly carrying pi-coding-agent's custom
 * roles) into a base LLM-compatible {@link Message}, or `undefined` if the
 * message should be omitted from LLM context.
 *
 * @param m - the agent message to convert
 *
 * @returns the LLM-compatible message, or `undefined` when the message is
 *   excluded from context (e.g. `bashExecution` with `excludeFromContext`)
 */
function toLlmMessage(
  m: AgentMessage,
): Message | undefined {
  if (m.role
    === 'bashExecution') {
    if (m.excludeFromContext
      === true)
      return undefined;
    return {
      role: 'user',
      content: [{
        type: 'text',
        text: bashExecutionToText(m,),
      },],
      timestamp: m.timestamp,
    };
  }
  if (m.role
    === 'custom') {
    /** Normalized content array; raw strings are wrapped before forwarding. */
    const content = ((typeof m.content) === 'string')
      ? [{
        type: 'text' as const,
        text: m.content,
      },]
      : m.content;
    return {
      role: 'user',
      content,
      timestamp: m.timestamp,
    };
  }
  if (m.role
    === 'branchSummary') {
    return {
      role: 'user',
      content: [{
        type: 'text',
        text: BRANCH_SUMMARY_PREFIX + m
          .summary
          + BRANCH_SUMMARY_SUFFIX,
      },],
      timestamp: m.timestamp,
    };
  }
  if (m.role
    === 'compactionSummary') {
    return {
      role: 'user',
      content: [{
        type: 'text',
        text: COMPACTION_SUMMARY_PREFIX + m
          .summary
          + COMPACTION_SUMMARY_SUFFIX,
      },],
      timestamp: m.timestamp,
    };
  }
  if ((m.role
    === 'user') || (m.role
      === 'assistant')
    || (m.role
      === 'toolResult'))
    return m;
  throw new Error(`convertToLlm: unhandled message role: ${JSON.stringify(m,)}`,);
}

/**
 * Transform extended `AgentMessage[]` (which may include pi-coding-agent's
 * custom roles like `bashExecution`, `custom`, `branchSummary`,
 * `compactionSummary`) into base LLM-compatible {@link Message | Messages}.
 *
 * Bit-for-bit compatible with pi-coding-agent's `convertToLlm` so summaries
 * fed to Morph Compact match what pi's default compaction would feed to its
 * summarization model.
 *
 * @param messages - extended agent messages
 *
 * @returns filtered list of LLM-compatible messages
 *
 * @example
 * ```typescript
 * convertToLlm(branchEntries.map(e => e.message));
 * // [{ role: 'user', content: [...], timestamp: ... }, ...]
 * ```
 */
export function convertToLlm(
  messages: AgentMessage[],
): Message[] {
  return messages
    .map(function mapToLlm(m,) {
      return toLlmMessage(m,);
    },)
    .filter(function isDefined(m,): m is Message {
      return m !== undefined;
    },);
}

//endregion

//region serializeConversation

/**
 * Extract concatenated text from a `user`-message content field, which may be
 * a raw string or a structured array of {@link TextContent}/{@link
 * ImageContent} blocks. Image blocks are dropped because Morph Compact
 * operates on text only.
 *
 * @param content - user message content (raw or structured)
 *
 * @returns concatenated text or empty string when no text was present
 */
function userTextFromContent(
  content: string | (TextContent | ImageContent)[],
): string {
  if ((typeof content) === 'string')
    return content;
  return content
    .filter(function isText(c,): c is TextContent {
      return c.type
        === 'text';
    },)
    .map(function readText(c,) {
      return c.text;
    },)
    .join('',);
}

/**
 * Serialize an LLM-compatible conversation into the bracketed
 * `[Role]: text` text format that pi's compaction summarizer expects. Tool
 * results are truncated to {@link TOOL_RESULT_MAX_CHARS} per call to keep the
 * summarization request within reasonable token budgets.
 *
 * Bit-for-bit compatible with pi-coding-agent's `serializeConversation`.
 *
 * @param messages - LLM-compatible messages, typically the output of
 *   {@link convertToLlm}
 *
 * @returns multi-paragraph string suitable as Morph Compact input
 *
 * @example
 * ```typescript
 * serializeConversation(convertToLlm(allMessages));
 * // '[User]: hello\\n\\n[Assistant]: hi'
 * ```
 */
export function serializeConversation(
  messages: Message[],
): string {
  /** Top-level accumulator joined into the final serialized transcript. */
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.role
      === 'user') {
      /** User-role text harvested from raw string or structured content. */
      const content = userTextFromContent(msg.content,);
      if (content)
        parts.push(`[User]: ${content}`,);
      continue;
    }
    if (msg.role
      === 'assistant') {
      /** Per-message accumulator for visible assistant text blocks. */
      const textParts: string[] = [];
      /** Per-message accumulator for hidden reasoning blocks. */
      const thinkingParts: string[] = [];
      /** Per-message accumulator for formatted tool-call signatures. */
      const toolCalls: string[] = [];
      for (const block of msg.content) {
        if (block.type
          === 'text') {
          textParts.push(block.text,);
          continue;
        }
        if (block.type
          === 'thinking') {
          thinkingParts.push(block.thinking,);
          continue;
        }
        if (block.type
          === 'toolCall') {
          /** Human-readable argument string injected into the tool-call signature. */
          const argsStr = Object
            .entries(block.arguments,)
            .map(function fmtArg([key, value,],) {
              return `${key}=${JSON.stringify(value,)}`;
            },)
            .join(', ',);
          toolCalls.push(`${block.name}(${argsStr})`,);
        }
      }
      if (thinkingParts.length
        > 0)
        parts.push(`[Assistant thinking]: ${thinkingParts.join('\n',)}`,);
      if (textParts.length
        > 0)
        parts.push(`[Assistant]: ${textParts.join('\n',)}`,);
      if (toolCalls.length
        > 0)
        parts.push(`[Assistant tool calls]: ${toolCalls.join('; ',)}`,);
      continue;
    }
    if (msg.role
      === 'toolResult') {
      /** Concatenated text payload after filtering out image blocks. */
      const content = msg
        .content
        .filter(function isText(c,): c is TextContent {
          return c.type
            === 'text';
        },)
        .map(function readText(c,) {
          return c.text;
        },)
        .join('',);
      if (content) {
        parts.push(
          `[Tool result]: ${
            truncateForSummary({
              text: content,
              maxChars: TOOL_RESULT_MAX_CHARS,
            },)
          }`,
        );
      }
    }
  }
  return parts.join('\n\n',);
}

//endregion
