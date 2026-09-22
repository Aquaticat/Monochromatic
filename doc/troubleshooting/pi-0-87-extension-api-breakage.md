# Pi 0.87 breaks auto-mode judge context and model-review provider requests

Updating the workspace Pi packages from 0.85.1 to 0.87.1
(`@earendil-works/pi-coding-agent`,
`@earendil-works/pi-ai`,
`@earendil-works/pi-agent-core`)
broke `package/pi-plugin/auto-mode` in two independent ways,
and a third defect kept both invisible to type checking.

## Symptom

Every guarded tool call in a Pi session returned this tool result instead of running:

```text
Unsupported Pi session message role.
```

The session file behind the failure
(`~/.pi/agent/sessions/--var-home-user-Monochromatic--/2026-09-22T22-20-40-582Z_01a0cb34-f505-738b-bad3-7ab0c7b00692.jsonl`)
contains one message entry with `role: "system"`,
`content: ""`,
named `sections`,
and a `toolsAdded` list.

## Root causes

### Hand-copied transcript projection threw on a new role

Pi 0.87 persists the system prompt and tool loadout as `role: "system"` session messages
(`AgentSession._preparePromptAndToolLoadout` in `dist/core/agent-session.js`),
and a compaction entry can carry one as `entry.systemMessage`.
`package/pi-plugin/auto-mode/src/visible-context.ts` reimplemented Pi's
entry-to-message conversion by hand
and ended its per-role `if` chain with `throw new Error('Unsupported Pi session message role.')`.
That throw gave no compile-time signal when the union grew,
and at runtime it failed judge-context construction for every guarded call.

Pi's own interactive renderer handles the same union differently
(`addMessageToChat` in `dist/modes/interactive/interactive-mode.js`):
`case "system"` draws nothing,
and `default` is a compile-time exhaustiveness check that renders nothing at runtime.

`agent-session.js` is byte-identical between 0.87.0 and 0.87.1,
and both versions persist system messages,
so the 0.87.0 to 0.87.1 step did not introduce this behavior;
the workspace lockfile moved from 0.85.1 straight to 0.87.1.

### Direct provider dispatch sent no system prompt and no tools

pi-ai 0.87 provider modules take a `TranscriptContext`
whose prompt and tools live in transcript system messages,
and only `normalizeContext()` (`dist/utils/transcript.js`) builds one.
Public entry points normalize (`dist/models.js`, `dist/compat.js`),
but the direct `api/*.lazy` modules that `package/pi-shared/model-review/src/provider-streams.ts`
calls do not:
`resolveTranscript` passes the context through unchanged.
model-review passed a raw `{ systemPrompt, messages, tools }` context,
so auto-mode and goal reviewer requests went out with no system prompt and no tools
while still forcing `tool_choice` to the verdict tool.

A local capture server proved the wire body.
For `anthropic-messages`,
the raw context sent `system` absent,
`tools` empty,
and `tool_choice: { type: "tool", name: "render_verdict" }`;
`normalizeContext(rawContext)` sent both.
The existing model-review tests passed throughout because their scripted transport bypasses provider dispatch.

### Type changes that tsc would have reported

- `SimpleStreamOptions.toolChoice` narrowed to provider-neutral `"auto" | "none"`.
  Provider modules still forward provider-specific selectors verbatim
  (`anthropic-messages.js` `buildParams`,
  `openai-responses.js`,
  `openai-completions.js`,
  `bedrock-converse-stream.js`).
- `ProviderHeaders` became `Record<string, string | null>`;
  `null` suppresses a provider default header of that name.

### Type checking was silently disabled repo-wide

`mise run //package/<path>:lint:types` exited 0 without running `tsc`,
so none of these type changes surfaced after the lockfile update.
See [`task-tsc-shared-chunk-silent-pass.md`](task-tsc-shared-chunk-silent-pass.md).

## Fixes

- `5dbade02f`:
  first targeted fix,
  treating `role: "system"` as hidden in `visible-context.ts`.
- `10220eb17`:
  `visible-context.ts` now calls Pi's exported `sessionEntryToContextMessages`,
  the step Pi's renderer runs.
  Pi's extension loader aliases `@earendil-works/pi-coding-agent` to the running host
  (`dist/core/extensions/loader.js`),
  so the projection always matches the host version.
  Unknown roles reach `omitUnknownRoleMessage(message: never)`,
  which fails `lint:types` when installed declarations add a role
  and logs plus omits the message at runtime.
  Pi's projection also normalizes `null` content from older session files,
  which previously threw a `TypeError`.
- `edd680e89`:
  restores `lint:types`.
- `d1f53ed92`:
  model-review normalizes the reviewer context at the provider boundary,
  types provider-specific `toolChoice` apart from `SimpleStreamOptions`,
  and adds `provider-request.unit.test.ts`,
  which captures real provider-module requests on a local server.
  `BudgetModelAuth.headers` in `package/pi-shared/model-selection/src/types.ts` accepts `null` values.

## Verification

- `context.unit.test.ts` failed with the original error before the first fix
  and covers system messages,
  compaction system messages,
  an unknown role,
  and `null` content.
- Removing the `system` branch in `visible-context.ts` makes `lint:types` report
  `SystemMessage ... is not assignable to parameter of type 'never'`.
- Removing `normalizeContext` makes both `provider-request.unit.test.ts` cases fail.
- The rebuilt auto-mode dist builds judge context from the failing session file without error.

## Rejected approaches

- Keeping the hand-copied projection and adding one `system` branch:
  fixes today's role only and repeats the failure on the next additive union change.
- Serializing unknown roles into judge context by denylisting known-hidden fields:
  would forward full system prompts and any future hidden payload to the judge.
- Throwing on unknown roles as a fail-closed guard:
  omission only removes judge context and cannot fabricate authorization,
  while throwing blocks every tool call and pushes users to disable the guard.

## Open questions

- Provider-specific `toolChoice` relies on provider modules forwarding a value their
  `SimpleStreamOptions` type no longer declares.
  Switching model-review to per-API `stream()` options would make it typed,
  at the cost of importing non-lazy provider modules.
- `package/dev-script/deps-update` runs no type check after a dependency bump,
  so a restored `lint:types` still depends on someone running it.
