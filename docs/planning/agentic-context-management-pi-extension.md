# Planning: agentic context management pi extension

Status:
 draft for grill-me review.
 Not built.
 Authored 2026-06-15.

## Goal

Build a pi extension that lets the active model replace selected prior context
with an explicit omission description by calling a tool.
The user-facing shorthand target is:

```text
# docs/planning/agentic-context-management-pi-extension.md
acm: {"/^As.+model,$/gm": ""}
```

After the next provider request is built,
the model should see this kind of request-time context instead of the original text:

```text
# docs/planning/agentic-context-management-pi-extension.md
User: Am I a cat?
Assistant: <omitted></omitted>
I don't know.
```

The important boundary:
this is request-time virtual context rewriting,
not a destructive session rewrite.
The original session transcript must stay intact so `/tree`,
resume,
audit,
and later debugging can recover exactly what happened.

## Source facts verified before this plan

- Pi's extension docs describe `context` as firing before each LLM call,
  with `event.messages` safe to modify and a `{ messages }` result replacing
  the request-time message list.
  Source path:
  `node_modules/.pnpm/@earendil-works+pi-coding-agent@0.79.4_zod@4.4.3/`
  `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`.
- The public type surface defines `ContextEvent` as `{ type: "context"; messages: AgentMessage[] }`,
  `ContextEventResult` as an optional replacement `messages` array,
  and `ExtensionAPI.on("context", ...)` as an overload
  (`.../dist/core/extensions/types.d.ts`).
- `ExtensionRunner.emitContext()` starts from `structuredClone(messages)`,
  runs extension handlers in load order,
  and chains each returned `messages` array into the next handler
  (`.../dist/core/extensions/runner.js`).
- Pi wires the extension runner into the agent as `transformContext`
  (`.../dist/core/sdk.js`).
- `pi-agent-core` applies `transformContext` before `convertToLlm()` and before the provider stream starts,
  so this plan operates at the `AgentMessage[]` layer rather than provider payload JSON
  (`.../dist/agent-loop.js` and `@earendil-works/pi-agent-core/README.md`).
- Session docs say `CustomEntry` does not participate in LLM context,
  while normal tool result messages do.
  Branch context is built from the active path,
  so state derived from current-branch tool results naturally follows `/tree` branching
  (`.../docs/session-format.md`).
- The emitted `ToolResultMessage` type includes `toolName`,
  `details`,
  `toolCallId`,
  `content`,
  `isError`,
  and `timestamp`,
  which is the exact surface ACM would replay
  (`@earendil-works/pi-ai/dist/types.d.ts`).
- `prepareArguments` exists on agent tools and is invoked before schema validation,
  so a compatibility shim for older or shorthand tool-call shapes is supported by the runtime
  (`@earendil-works/pi-agent-core/dist/types.d.ts` and `.../dist/agent-loop.js`).
- `CustomEntry` is explicitly documented in Pi's session-manager type definitions as ignored by
  `buildSessionContext`,
  while `CustomMessageEntry` participates in LLM context
  (`.../dist/core/session-manager.d.ts`).

## Recommended architecture

Use one extension package under `packages/pi/agentic-context-management/`.
The package registers one model-callable tool named `acm`
and one `context` event handler.

### Request flow

- The assistant emits normal text.
- The assistant calls `acm` with one or more substitution rules.
- The `acm` tool validates and normalizes the call.
- The `acm` tool returns a tool result whose `details` contain the normalized rules.
- On every later LLM call,
  the `context` handler scans the current branch messages for prior `acm` tool results,
  derives active rules,
  and applies them to a cloned message list.
- Rules apply immediately to the next provider request after the successful `acm` tool call;
  preview and list surfaces are diagnostic aids,
  not prerequisites.
- The provider receives only the transformed `AgentMessage[]` after normal `convertToLlm()` conversion.
- The session file still contains the original text and the `acm` audit trail.

This makes the tool result the source of truth.
No module-level memory is needed for correctness after reload,
resume,
or branch navigation.

### Why this design wins

Option A:
store rules in `acm` tool result details,
then apply them from the `context` event.

Pros:
branch-aware by construction,
replayable after reload,
auditable,
non-destructive,
and aligned with Pi's request-time `context` hook.

Cons:
the `acm` tool result remains visible to the model unless the context handler also compresses old `acm` records.
The model can infer that a rewrite happened.
That is acceptable because this feature is for context pressure,
not secrecy.

Option B:
store rules in `pi.appendEntry()` custom entries.

Pros:
keeps rule metadata out of LLM context by default.

Cons:
`CustomEntry` does not participate in LLM context,
so the `context` event would have to read `ctx.sessionManager.getBranch()`
and reconcile custom entries with message position manually.
That creates more branch and ordering edge cases than tool result details.

Option C:
rewrite finalized assistant messages in `message_end`.

Pros:
simple mental model,
because future session context would already contain the omitted marker.

Cons:
destructive session mutation breaks auditability and makes `/tree` less useful.
It also gives the model a way to alter the recorded transcript,
which is the wrong security and debugging boundary.

Ranking:
A beats B because the current branch's tool results already encode ordering and branching.
B beats C because non-destructive state is still recoverable,
while destructive message rewriting loses evidence.

## Tool contract

The public tool name should be `acm`.
The long label can be `Agentic Context Management`.

Recommended strict schema:

```typescript
// docs/planning/agentic-context-management-pi-extension.md
{
  action: "substitute" | "disable" | "list";
  substitutions?: Array<{
    target:
      | "previous_assistant_text"
      | "recent_assistant_text"
      | "all_prior_assistant_text"
      | "previous_tool_result_text"
      | "recent_tool_result_text"
      | "all_prior_tool_result_text";
    match: {
      kind: "literal" | "regex";
      value: string;
      flags?: string;
    };
    description: string;
  }>;
  ruleIds?: string[];
}
```

Compatibility shim:
`prepareArguments()` should accept the shorthand shown by the user as an illustrative notation.
Actual model tool calls must still arrive as JSON-compatible arguments,
so the implementation should support a string-map shape such as:

```typescript
// docs/planning/agentic-context-management-pi-extension.md
{"/^As.+model,$/gm": ""}
```

The shim normalizes it to:

```typescript
// docs/planning/agentic-context-management-pi-extension.md
{
  action: "substitute",
  substitutions: [
    {
      target: "previous_assistant_text",
      match: {
        kind: "regex",
        value: "^As.+model,$",
        flags: "gm"
      },
      description: ""
    }
  ]
}
```

The replacement text is always generated by the extension:

```text
# docs/planning/agentic-context-management-pi-extension.md
<omitted>description escaped for text context</omitted>
```

An empty description intentionally produces `<omitted></omitted>`.
The description is the model-supplied JSON string from the tool call;
JavaScript and JSON strings may be empty,
and the extension must treat that as valid input.
Before insertion into the XML-like marker,
the extension must escape description text for the marker text context.
The tool should not allow arbitrary raw replacement text in the MVP,
because raw replacement lets the model silently rewrite history.
The model may only omit and describe.

## Scope guardrails

Default scope must be assistant-authored text plus tool result text.
This records the user's 2026-06-15 answer to the first grill-me question:
ACM should be allowed to rewrite tool call results as well.
The MVP should reject attempts to rewrite:

- user messages,
- tool call blocks,
- thinking blocks,
- custom messages from other extensions,
- system prompt text.

Reason:
the model should be able to compact its own redundant prose and bulky tool outputs,
not hide the user's requirements from itself.
Tool output omission is still evidence-sensitive,
so the MVP must preserve the tool call block,
tool name,
tool call id,
`isError`,
and `details` metadata even when it rewrites result text.
ACM's own tool results are not eligible for rewriting,
so the audit trail for active rules stays visible.
If a later version supports user-message omission,
that must be an explicit config setting and should require user approval.

The context transformer must preserve all non-text content blocks exactly.
For assistant messages and tool result messages,
only `TextContent.text` may change.
`toolCall` blocks must stay intact so the provenance of each result remains visible.

## Matching plan

The implementation must not run arbitrary model-generated JavaScript regular expressions
against unbounded conversation text.
That is both a performance risk and a denial-of-service footgun.

Recommended MVP:

- support literal matching without copying giant spans into tool arguments;
- support bounded regex for the user shorthand path;
- run a safety spike before implementation to choose the abortable boundary or safe regex engine;
- reject raw full-context JavaScript `RegExp` matching;
- for the bounded regex path,
  enforce short pattern,
  short flags allowlist,
  and bounded text block size;
- reject regexes that exceed those bounds;
- do not require or store expected match counts;
- do not require or store explicit occurrence limits;
- for regex matching,
  use JavaScript-style global-flag semantics:
  `/g` rewrites every match inside the selected target,
  while no `/g` rewrites the first match only;
- for literal matching,
  rewrite the first matching span only unless a later design adds an explicit literal-all mode;
- treat zero matches as a no-op with diagnostics rather than a rule-contract failure;
- run a Phase 1 spike to verify whether custom tool execution can see the just-finished assistant message
  through `ctx.sessionManager`;
- until that visibility is proven,
  treat install-time match counting as best effort and rely on the `context` pass for enforcement.

Do not pick a regex dependency in the first implementation pass without running the repo's
technology-selection process.
If a dependency becomes necessary,
run a source audit for the finalist and at least two alternatives before adding it.

## Rule replay semantics

Each successful `acm` tool result should store JSON-serializable details:

```typescript
// docs/planning/agentic-context-management-pi-extension.md
type AcmToolDetails = {
  readonly version: 1;
  readonly actions: readonly AcmAction[];
};

type AcmAction =
  | {
      readonly type: "add";
      readonly id: string;
      readonly createdByToolCallId: string;
      readonly target:
        | "previous_assistant_text"
        | "recent_assistant_text"
        | "all_prior_assistant_text"
        | "previous_tool_result_text"
        | "recent_tool_result_text"
        | "all_prior_tool_result_text";
      readonly match: AcmMatch;
      readonly description: string;
    }
  | {
      readonly type: "disable";
      readonly ids: readonly string[];
    };
```

The `context` handler should:

- scan messages in source order;
- collect `toolResult` messages whose `toolName` is `acm`;
- replay `add` and `disable` actions into an active rule map;
- keep rules active on the current branch until a later `disable` action removes them;
- apply active rules in creation order;
- skip a rule when it would delete or alter a non-text block;
- skip overlapping replacements rather than guessing;
- produce deterministic output from the original cloned messages each time.

A skipped rule should leave the original text unchanged and surface a compact diagnostic in the tool result or UI.
It should never corrupt the provider request.

## Context output example

Original active branch:

```text
# docs/planning/agentic-context-management-pi-extension.md
User: Am I a cat?
Assistant text block: As a large language model,
I don't know.
Assistant tool call block: acm({"/^As.+model,$/gm": ""})
Tool result: acm installed rule acm_001
```

Derived provider context on the next LLM call:

```text
# docs/planning/agentic-context-management-pi-extension.md
User: Am I a cat?
Assistant text block: <omitted></omitted>
I don't know.
Assistant tool call block: acm({"/^As.+model,$/gm": ""})
Tool result: acm installed rule acm_001
```

The session file still contains `As a large language model,`.
Only the request-time clone is changed.

## Package shape

Create:

```text
# docs/planning/agentic-context-management-pi-extension.md
packages/pi/agentic-context-management/
  package.json
  mise.toml
  src/index.ts
  src/tool.ts
  src/context-transform.ts
  src/rules.ts
  src/matchers.ts
  src/render.ts
  src/*.unit.test.ts
```

Use sibling pi packages as templates:

- `packages/pi/current-time-context/` for simple extension package metadata,
  build tasks,
  and verify task shape.
- `packages/pi/morph-compact/` for a more complex extension with commands,
  event handlers,
  and renderer helpers.
- `packages/pi/spawn/src/pi-test-harness.ts` for a fake `ExtensionAPI` harness pattern.

Expected package metadata:

- package name:
  `@monochromatic-dev/pi-agentic-context-management`;
- `peerDependencies`:
  `@earendil-works/pi-coding-agent` and any runtime schema package that pi expects;
- `devDependencies` from the workspace catalog;
- `pi.extensions` pointing at `./dist/final/node/index.mjs`;
- `exports` matching sibling pi packages;
- `mise.toml` extending the shared `build`,
  `lint`,
  `lint:types`,
  `lint:oxlint`,
  and `test:unit` tasks.

## Implementation phases

### Phase 1: minimal branch-safe omission

- Register `acm` with strict schema and shorthand compatibility.
- Implement rule details in tool results.
- Implement `context` handler that derives rules from current `event.messages`.
- Transform only assistant `TextContent.text`.
- Transform tool result `TextContent.text` for explicit tool-result targets,
  while preserving tool result metadata and non-text blocks.
- Support all six MVP targets:
  `previous_assistant_text`,
  `recent_assistant_text`,
  `all_prior_assistant_text`,
  `previous_tool_result_text`,
  `recent_tool_result_text`,
  and `all_prior_tool_result_text`.
- Exclude `acm` tool results from tool-result targets.
- Add a terse custom renderer for `acm` tool calls and results.

Definition of done:
the user's example is covered by a unit test and by an extension-runner integration test.
The phase also records the answer to the tool-execution visibility spike:
whether `ctx.sessionManager` inside `execute()` includes the assistant message that requested the `acm` call.

### Phase 2: management commands and diagnostics

- Add `action: "list"` so the model can inspect active rules.
- Add `action: "disable"` so the model can retire bad rules.
- Add `/acm-list` for the human user.
- Add `/acm-preview` to show transformed context without sending it to a provider.
- Add diagnostics for invalid regex,
  zero matches,
  broad `/g` matches,
  and overlap skips.

Definition of done:
a bad rule can be found and disabled without editing the session file.

### Phase 3: hardening after all-scope MVP

- Tune broad-target diagnostics after the all-scope MVP has real fixtures.
- Consider user-approved omission of user messages or ACM's own tool results as a later explicit opt-in.
- Decide whether old `acm` tool results should themselves be compacted into a smaller custom message.

Definition of done:
the extension can compress older assistant and eligible tool context without risking user instruction loss.

## Tests to write before implementation is declared complete

Unit tests:

- shorthand input normalizes to strict schema;
- invalid action is rejected;
- regex flags outside the allowlist are rejected;
- empty description renders `<omitted></omitted>`;
- description text escapes `<`,
  `>`,
  and `&` before insertion into the omitted tag;
- assistant-targeted rules transform only assistant text blocks;
- explicit tool-result targets transform only tool result text blocks;
- ACM tool result text remains unchanged even when a broad tool-result rule would match;
- tool result `details`,
  `toolName`,
  `toolCallId`,
  `isError`,
  and image blocks remain unchanged;
- user messages remain unchanged;
- tool call blocks remain unchanged;
- overlapping replacements skip deterministically;
- disabled rule no longer applies;
- branch-specific rule replay ignores tool results that are not on `event.messages`.

Integration tests:

- register the extension in a fake `ExtensionAPI` harness;
- invoke the captured `context` handler with a branch containing the user's example;
- assert the returned messages contain `<omitted></omitted>` and not the boilerplate line;
- assert the original input array was not mutated,
  matching Pi's `structuredClone` request-time contract;
- assert multiple context handlers can chain without losing ACM output.

End-user boundary verification for the eventual implementation:

- run the built extension through pi or the Pi SDK in a throwaway session;
- capture the provider payload with `before_provider_request` or a fake provider;
- confirm the payload excludes the omitted assistant text and omitted tool result text;
- confirm the session JSONL still includes the original assistant text,
  original tool result text,
  and the `acm` tool result;
- trigger `/tree` or an equivalent branch fixture and confirm only current-branch rules apply.

## Non-goals

- Do not promise privacy or secrecy.
  The original text remains in the local session file,
  may have been sent to the provider before omission,
  and may be visible to other extensions depending on load order.
- Do not rewrite system prompt text through this plugin.
  `context` operates on messages,
  while system prompt control belongs to `before_agent_start` or provider payload hooks.
- Do not mutate session history to make the transcript appear cleaner.
- Do not auto-omit user requirements.
  Tool output omission is allowed only through explicit ACM rules,
  not through automatic broad deletion.
- Do not replace Pi's built-in compaction.
  This is fine-grained self-omission,
  not whole-session summarization.

## Risks and mitigations

Risk:
the model hides a user constraint from itself.

Mitigation:
user-message rewrite remains out of scope unless the user explicitly opts in later.

Risk:
the model hides tool evidence from itself.

Mitigation:
allow only tool result text rewrites,
keep tool call blocks and tool result metadata intact,
and require target scoping plus list/preview diagnostics.

Risk:
a broad pattern omits too much.

Mitigation:
small target scopes,
`/g` semantics,
preview/list commands,
and deterministic skip behavior for ambiguous matches.

Risk:
regex matching hangs the extension.

Mitigation:
ship literal matching first,
then enable regex only after proving an abortable matching boundary or selecting a source-audited safe engine.

Risk:
tool arguments duplicate the text being removed.

Mitigation:
prefer regex or bounded range-style selectors for large spans,
reject huge literal match strings,
and keep literal matching for short exact phrases only.

Risk:
other extensions observe different context than ACM expects.

Mitigation:
document extension load order,
keep ACM's transformer pure,
and add tests where a second context handler runs after ACM.

## Grill-me decision tree

Ask these one at a time before broadening the implementation.
Recommended answers are included so the discussion has a default path.

### Question 1: what may ACM rewrite?

Decision:
assistant-authored text and tool result text are both in scope for the MVP.
User answered this on 2026-06-15.

Pros:
solves the example,
lets ACM compress bulky command or read outputs,
and still preserves user instructions by keeping user messages out of scope.

Cons:
tool output is evidence,
so an overbroad rule can make the model forget command output or test failures.
The implementation must preserve tool metadata and provide preview/list diagnostics.

Rejected alternative:
assistant-authored text only.

Pros:
smaller safety surface.

Cons:
leaves the largest context chunks,
especially tool results,
for normal compaction only.

Rejected alternative:
allow any message role with user approval.

Pros:
maximal token savings.

Cons:
harder safety boundary,
more UI decisions,
and more ways to make future behavior diverge from the user's actual instructions.

Ranking:
assistant plus tool-result text beats assistant-only because tool results are often the largest removable context cost.
Assistant-only beats any-role because preserving user instructions matters more than maximal compression.

### Question 2: how much regex power is acceptable?

Decision:
ACM should support bounded regex.
User answered this on 2026-06-15.

Pros:
supports the requested `/^As.+model,$/gm` shorthand path,
keeps flexible selectors for recurring boilerplate and long tool output,
and avoids unbounded full-context regex execution.

Cons:
some expressive regexes are rejected,
and implementation must prove a safe matching boundary before enabling regex by default.

Rejected alternative:
short literal matching only.

Pros:
safest and simplest MVP.

Cons:
weak for variable boilerplate,
and literal matching can require copying text that itself costs context.

Rejected alternative:
raw JavaScript `RegExp` over full context.

Pros:
smallest implementation and most compatible with arbitrary regex syntax.

Cons:
model-generated regex can hang or over-match.

Ranking:
bounded regex beats literal-only because it preserves the requested example while controlling hangs.
Literal-only beats raw JavaScript regex because predictable safety matters more than unrestricted pattern syntax.

### Question 3: where should active rules live?

Decision:
active rules should live in `acm` tool result `details`,
replayed from the current branch.
User answered this on 2026-06-15.

Pros:
branch-safe,
auditable,
reload-safe,
and no hidden memory state.

Cons:
rule details are visible to the model unless separately compacted.

Rejected alternative:
hybrid state,
with tool results as audit trail and custom entries as a hidden cache.

Pros:
keeps an audit trail while avoiding repeated replay work.

Cons:
two sources of truth and extra invalidation logic after branch changes,
compaction,
and reload.

Rejected alternative:
custom entries via `pi.appendEntry()`.

Pros:
metadata stays out of context.

Cons:
branch and ordering reconstruction becomes extension-specific.

Ranking:
tool result details beat hybrid state because one replayable source of truth is simpler and safer.
Hybrid state beats custom entries because at least the tool result remains the visible audit trail.

### Question 4: which tool results may ACM rewrite?

Decision:
all non-ACM tool result text blocks are eligible,
with ACM's own tool results excluded.
User answered this on 2026-06-15.

Pros:
matches the user's decision that tool call results are in scope,
handles bulky `read`,
`bash`,
search,
and custom-tool outputs,
and preserves ACM's audit trail.

Cons:
custom tool output can carry important state,
so bad rules can still hide evidence from the next provider request.
Preview/list diagnostics and exact match counts become mandatory.

Rejected alternative:
only bulky built-in tools are eligible by default,
for example `read`,
`bash`,
`grep`,
`find`,
and `ls`.

Pros:
smaller safety surface and easier tests.

Cons:
custom tools that generate large context remain outside ACM unless the user adds config.

Rejected alternative:
all tool results,
including ACM's own tool results,
are eligible.

Pros:
maximum compression.

Cons:
the model can hide or corrupt the very audit trail that explains why context changed.

Ranking:
non-ACM tool results beat bulky built-ins because user intent named tool results broadly.
Bulky built-ins beat all tool results because preserving ACM's own audit trail matters.

### Question 5: how long should rules live?

Decision:
rules persist on the active branch until disabled.
User answered this on 2026-06-15.

Pros:
one `acm` call keeps redundant boilerplate or bulky output omitted across future turns,
which matches context-management intent and avoids repeated tool calls.

Cons:
a stale rule can keep applying after its original context is no longer relevant,
so list/disable tooling must be easy to use.

Rejected alternative:
rules apply only to the next provider request.

Pros:
lowest risk of stale omissions.

Cons:
the model must repeatedly call ACM for recurring boilerplate,
which adds tool noise and context cost.

Rejected alternative:
rules expire after a fixed number of turns.

Pros:
limits stale omissions while still lasting longer than one request.

Cons:
turn counting through tool-call loops,
steering,
follow-ups,
and branch navigation adds lifecycle complexity.

Ranking:
persist-until-disabled beats fixed turn expiry because explicit state is easier to audit.
Fixed turn expiry beats next-request-only because it can still reduce recurring context cost.

### Question 6: should rules include expected match counts?

Decision:
rules should not include expected match counts.
User answered this on 2026-06-15 after asking why a rule would include one.

Pros:
simpler tool calls,
less brittle matching,
and no need for the model to predict exact match counts before ACM validates context.

Cons:
ACM loses a stale-rule guard,
so target scoping,
preview/list diagnostics,
and conservative broad-match behavior become more important.

Rejected alternative:
ACM computes and stores an internal expected count.

Pros:
protects against a rule that matched one span at install time later matching zero or many spans.

Cons:
needs reliable install-time or first-apply counting,
and can disable a useful rule when harmless context drift changes counts.

Rejected alternative:
the model supplies the expected count.

Pros:
explicit contract in the tool call.

Cons:
noisy and brittle,
because the model must know counts before the extension validates matches.

Ranking:
no count beats internal guard because user intent favors simpler rules over count contracts.
Internal guard beats model-supplied count because computed metadata is less noisy than asking the model.

### Question 7: how many matches should a rule apply to?

Decision:
regex `/g` rewrites all matches inside the selected target,
regex without `/g` rewrites one match,
and literal matching rewrites one span by default.
User answered this on 2026-06-15.

Pros:
matches common regex replacement semantics,
keeps the shorthand easy to understand,
and avoids a second count-like parameter after rejecting expected match counts.

Cons:
`/g` can omit many spans if the pattern is broad,
so preview/list diagnostics and target scoping carry the safety burden.

Rejected alternative:
explicit occurrence limits.

Pros:
every rule states its replacement cap.

Cons:
noisy and contrary to the user's preferred `/g` semantics.

Rejected alternative:
always rewrite every match.

Pros:
simplest schema.

Cons:
non-global regexes and literal matches can erase more than the caller intended.

Ranking:
`/g` semantics beat explicit limits because they match user expectation and common regex behavior.
Explicit limits beat always-all because bounded replacement is safer than implicit broad omission.

### Question 8: which target scopes belong in the MVP?

Decision:
all target scopes belong in the MVP.
User answered this on 2026-06-15.

Pros:
most powerful first release,
lets the model compact older scattered assistant and tool-result context immediately,
and matches the broad goal of letting the active model manage its own context.

Cons:
widest blast radius for broad `/g` patterns and longest verification path.
All-prior targets need strong fixtures before implementation is declared complete.

Rejected alternative:
MVP includes previous assistant text and previous non-ACM tool result text,
then adds recent-window scopes after the first tests pass.

Pros:
solves the example and the tool-result use case while keeping matching surfaces small.

Cons:
the model cannot compact older scattered context until recent/all-prior scopes land.

Rejected alternative:
MVP includes previous and recent-window scopes.

Pros:
useful for context emitted a few turns back.

Cons:
requires a window definition and more branch tests immediately,
without delivering the all-prior control the user wants.

Ranking:
all-scopes beats previous-plus-recent because the user wants broad tool-call control over context.
Previous-plus-recent beats previous-only because it covers more real stale-context cases.

### Question 9: should ACM rules apply immediately or require preview first?

Decision:
rules apply immediately after a successful `acm` tool call.
User answered this on 2026-06-15.
Separate `list` and preview surfaces still exist for diagnostics,
but they are not prerequisites.

Pros:
matches agentic tool-call control,
keeps the loop fast,
and avoids turning every context rewrite into a two-step ceremony.

Cons:
a bad all-prior `/g` rule affects the next provider request before the model inspects preview output.

Rejected alternative:
require a dry-run tool call before an apply tool call.

Pros:
forces visibility into broad rewrites.

Cons:
doubles tool calls and token noise for the common case.

Rejected alternative:
require human approval for broad scopes.

Pros:
strongest guard for all-prior rewrites.

Cons:
breaks the core requirement that the active model can manage context agentically via tool calls.

Ranking:
immediate apply beats dry-run-first because the plugin is explicitly agentic.
Dry-run-first beats human approval because it preserves autonomous operation.

### Question 10: what should omitted markers contain?

Decision:
`description` is a model-supplied JSON string,
empty strings are valid,
and the marker renders that escaped string between `<omitted>` and `</omitted>`.
User clarified this on 2026-06-15:
"It's just a string models pass to the toolcall. And in js/json strings can be empty."

Pros:
matches the user's example `<omitted></omitted>`,
keeps token cost low,
and lets the model add a description only when it helps future reasoning.

Cons:
empty markers may be hard to understand in later context without inspecting ACM diagnostics.

Rejected alternative:
require a non-empty description for every omission.

Pros:
every omission carries a human-readable reason.

Cons:
adds token cost and forces noisy filler for obvious boilerplate.

Rejected alternative:
use structured marker metadata,
for example attributes with rule id and match count.

Pros:
more auditable inside the transformed context.

Cons:
adds syntax-escaping complexity and token overhead to every omission.

Ranking:
empty-allowed strings beat required descriptions because JSON strings can be empty and the user's example uses that.
Required description beats structured metadata because prose is simpler and cheaper than attributes.

### Question 11: where should diagnostics appear?

Decision:
diagnostics live in `acm` tool result `details` and are exposed through `list` and preview commands,
without injecting extra context messages.
User answered this on 2026-06-15.

Pros:
keeps diagnostics auditable without adding hidden prompt tokens on every provider request.

Cons:
the model must ask for diagnostics or inspect tool results to notice skipped or broad rewrites.

Rejected alternative:
inject a hidden custom message with active diagnostic summaries.

Pros:
the model sees stale or skipped-rule warnings automatically.

Cons:
adds context tokens and creates a second source of ACM state.

Rejected alternative:
show diagnostics only in the TUI.

Pros:
zero model context cost.

Cons:
the model cannot use diagnostics to repair bad rules.

Ranking:
tool-result plus commands beat hidden context because diagnostics should be available but not always injected.
Hidden context beats TUI-only because model-visible repair matters for agentic operation.

### Question 12: should ACM change only provider context or also rendered transcript UI?

Recommended answer:
ACM rewrites provider context only.
The transcript UI and session JSONL keep the original text plus ACM audit trail.

Pros:
maximal auditability,
matches Pi's `context` event boundary,
and avoids confusing `/tree` or resume behavior.

Cons:
the human may still see large original tool outputs in the transcript UI unless normal tool-collapse UI hides them.

Alternative:
also render omitted markers in the UI while keeping JSONL original.

Pros:
human view matches model view.

Cons:
adds a parallel renderer path and may hide useful audit details from visual review.

Alternative:
rewrite session history destructively.

Pros:
every surface matches the omitted context.

Cons:
loses evidence and breaks the core non-destructive design.

Ranking:
provider-only beats UI-mirrored because the context hook's strength is non-destructive request-time rewriting.
UI-mirrored beats destructive history rewrite because original evidence remains recoverable.

## First implementation decision needed

Question 1 is resolved:
assistant text and tool result text are both in scope.
Question 2 is resolved:
bounded regex is in scope,
while raw JavaScript `RegExp` over full context is out of scope.
Question 3 is resolved:
active rules live in `acm` tool result `details`.
Question 4 is resolved:
all non-ACM tool result text blocks are eligible,
with ACM's own tool results excluded.
Question 5 is resolved:
rules persist on the active branch until disabled.
Question 6 is resolved:
rules do not include expected match counts.
Question 7 is resolved:
regex `/g` rewrites all matches,
regex without `/g` rewrites one match,
and literal matching rewrites one span by default.
Question 8 is resolved:
all target scopes belong in the MVP.
Question 9 is resolved:
rules apply immediately after a successful `acm` tool call.
Question 10 is resolved:
descriptions are model-supplied strings,
and empty strings are valid.
Question 11 is resolved:
diagnostics live in `acm` tool result `details` plus `list` and preview commands.
Before building past Phase 1,
answer Question 12.
My recommendation is provider-context-only rewriting,
with transcript UI and session JSONL left original.
