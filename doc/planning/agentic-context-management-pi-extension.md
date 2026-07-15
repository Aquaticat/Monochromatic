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
# doc/planning/agentic-context-management-pi-extension.md
acm: {"/^As.+model,$/gm": ""}
```

After the next provider request is built,
the model should see this kind of request-time context instead of the original text:

```text
# doc/planning/agentic-context-management-pi-extension.md
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
  (`.../doc/session-format.md`).
- The emitted `ToolResultMessage` type includes `toolName`,
  `details`,
  `toolCallId`,
  `content`,
  `isError`,
  and `timestamp`,
  which is the exact surface ACM would replay
  (`@earendil-works/pi-ai/dist/types.d.ts`).
- Provider adapters inspected serialize tool result `content` to provider payloads and do not serialize `details`.
  Verified in `@earendil-works/pi-ai/dist/providers/openai-completions.js`,
  `.../openai-responses-shared.js`,
  and `.../anthropic.js`.
- `prepareArguments` exists on agent tools and is invoked before schema validation,
  so a compatibility shim for older or shorthand tool-call shapes is supported by the runtime
  (`@earendil-works/pi-agent-core/dist/types.d.ts` and `.../dist/agent-loop.js`).
- `CustomEntry` is explicitly documented in Pi's session-manager type definitions as ignored by
  `buildSessionContext`,
  while `CustomMessageEntry` participates in LLM context
  (`.../dist/core/session-manager.d.ts`).

## Recommended architecture

Use one extension package under `packages/pi-plugin/agentic-context-management/`.
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
  `list` is a diagnostic aid,
  not a prerequisite.
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
the `acm` tool result content remains visible to the model unless the context handler also compresses old `acm` records.
Structured `details` remain available to the extension and transcript UI,
but provider adapters inspected do not send `details` to the model.
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
// doc/planning/agentic-context-management-pi-extension.md
{
  action: "substitute" | "disable" | "list";
  substitutions?: Array<{
    match: {
      kind: "literal" | "regex";
      value: string;
      flags?: string;
    };
    description: string;
  }>;
  matches?: Array<{
    kind: "literal" | "regex";
    value: string;
    flags?: string;
  }>;
}
```

For `action: "disable"`,
`matches` contains exact normalized matchers to remove.
The extension disables every active rule whose matcher equals a supplied matcher after normalization.
Descriptions are not part of the disable key.
Matcher equality is the canonical tuple:
`kind`,
exact `value`,
and sorted unique `flags` for regex matchers.
Unsupported or duplicate flags are rejected rather than normalized silently.
No deeper regex semantic equivalence is attempted.

For `action: "list"`,
the tool result content should return compact active-rule summaries:
normalized matcher,
description,
source `toolCallId`,
creation order,
current assistant-text match count,
current tool-result-text match count,
and skip diagnostics.
The list output must not include matched text snippets by default,
because that can reintroduce omitted text into provider context.
The tool result `details` should store the same structured summary for UI rendering and replay tests.

For `action: "substitute"` and `action: "disable"`,
the tool result content should also return matcher summaries without snippets:
normalized matcher,
description for added rules,
action result,
current match counts,
and warnings.
This keeps exact-match disable usable from provider-visible context.

Compatibility shim:
`prepareArguments()` should accept the shorthand shown by the user as an illustrative notation.
Actual model tool calls must still arrive as JSON-compatible arguments,
so the implementation should support a string-map shape such as:

```typescript
// doc/planning/agentic-context-management-pi-extension.md
{"/^As.+model,$/gm": ""}
```

The shim normalizes it to:

```typescript
// doc/planning/agentic-context-management-pi-extension.md
{
  action: "substitute",
  substitutions: [
    {
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

Shorthand key parsing:

- keys that start with `/` are parsed as `/pattern/flags` regex matchers;
- the closing delimiter is the last unescaped `/`;
- escaped slashes stay inside the pattern;
- invalid slash-regex keys are rejected rather than falling back to literal matching;
- keys that do not start with `/` become literal matchers;
- literal strings shaped like slash-regex keys must use the strict schema.

The replacement text is always generated by the extension:

```text
# doc/planning/agentic-context-management-pi-extension.md
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

## Target selection semantics

ACM no longer has `previous_*`,
`recent_*`,
or `all_prior_*` target scopes.
The user clarified on 2026-06-15 that rules apply to everything eligible.

For each provider request,
every active substitution scans every eligible text block in `event.messages`,
in message order and content-block order.
Eligible text blocks are:

- assistant `TextContent.text` blocks,
- non-ACM tool result `TextContent.text` blocks.

Ineligible context remains unchanged:

- user messages,
- system prompt text,
- assistant `toolCall` blocks,
- assistant `thinking` blocks,
- image blocks,
- custom messages from other extensions,
- ACM's own tool result text and details.

Rules are rolling while active:
a substitution can affect eligible assistant or tool-result text that appears after the tool call that installed it.
A rule stops being active when a later `disable` action removes it,
or when Pi compaction removes the source `acm` tool result from `event.messages`.
No anchor to a previous or recent block is needed.

## Matching plan

The implementation must not run arbitrary model-generated JavaScript regular expressions
against unbounded conversation text.
That is both a performance risk and a denial-of-service footgun.

Recommended MVP:

- support literal matching without copying giant spans into tool arguments;
- support safe-engine regex for the user shorthand path;
- run Phase 0 before implementation to choose the exact source-audited safe regex engine;
- reject raw full-context JavaScript `RegExp` matching;
- for the safe-engine regex path,
  enforce the supported-flags allowlist,
  duplicate-flag rejection,
  canonical flag ordering,
  and safe-engine syntax validation;
- do not add ACM-specific length,
  inspected-character,
  replacement-count,
  or active-rule caps;
- do not require or store expected match counts;
- do not require or store explicit occurrence limits;
- for regex matching,
  use JavaScript-style global-flag semantics:
  `/g` rewrites every match across eligible text blocks in source order,
  while no `/g` rewrites the first match across eligible text blocks;
- for literal matching,
  rewrite the first matching span across eligible text blocks
  unless a later design adds an explicit literal-all mode;
- install zero-current-match rules with diagnostics rather than rejecting them,
  because rolling rules may intentionally target future eligible context;
- tool execution does not need to read the just-finished assistant message for anchoring,
  because target selection is all eligible provider context.

Do not pick a regex dependency in the first implementation pass without running the repo's
technology-selection process.
If a dependency becomes necessary,
run a source audit for the finalist and at least two alternatives before adding it.
Phase 0 should prefer a source-audited safe regex engine with documented linear-time behavior.
Abortable workers are the fallback strategy only if the safe-engine audit fails and the user reopens the decision.
Hand-rolled syntax restriction and literal-only regex deferral are rejected as default strategies.

## Rule replay semantics

Each successful `acm` tool result should store JSON-serializable details:

```typescript
// doc/planning/agentic-context-management-pi-extension.md
type AcmToolDetails = {
  readonly version: 1;
  readonly actions: readonly AcmAction[];
  readonly installDiagnostics: readonly AcmInstallDiagnostic[];
};

type AcmAction =
  | {
      readonly type: "add";
      readonly match: AcmMatch;
      readonly description: string;
    }
  | {
      readonly type: "disable";
      readonly matches: readonly AcmMatch[];
    };
```

The stored action does not need `createdByToolCallId` or a rule id.
During replay,
the enclosing `ToolResultMessage.toolCallId` remains available for audit,
but target selection and disable semantics do not depend on it.

The `context` handler should:

- scan messages in source order;
- collect successful `toolResult` messages whose `toolName` is `acm`;
- ignore errored ACM tool results,
  malformed details,
  and unknown details versions safely;
- replay `add` and `disable` actions into an ordered active-rule map keyed by normalized matcher;
- apply an `add` action by replacing any existing active rule with the same normalized matcher,
  then inserting the new rule at the latest creation order;
- apply a `disable` action by removing every active rule whose normalized matcher equals a supplied matcher;
- keep rules active in request context until a later `disable` action removes them,
  or until Pi compaction removes the source `acm` tool result from provider context;
- build the eligible text-block list from the request-time clone;
- collect candidate replacement spans by scanning each eligible text block's original text;
- apply active rules in creation order;
- skip candidates that overlap an earlier accepted span;
- render each changed text block once from its original text and accepted spans;
- produce deterministic output from the original cloned messages each time.

Matching against original text prevents later rules from matching inside an earlier
`<omitted>...</omitted>` marker.
Earlier rules win overlap conflicts.

A skipped rule leaves the original text unchanged and never corrupts the provider request.
Install-time diagnostics belong in the current `acm` tool result `details`
and should be summarized compactly in the current tool result `content`.
Request-time diagnostics are recomputed by `action: "list"`
and `/acm-list`,
and are not written back into older tool result details.

## Context output example

Original active branch:

```text
# doc/planning/agentic-context-management-pi-extension.md
User: Am I a cat?
Assistant text block: As a large language model,
I don't know.
Assistant tool call block: acm({"/^As.+model,$/gm": ""})
Tool result: acm installed rule acm_001
```

Derived provider context on the next LLM call:

```text
# doc/planning/agentic-context-management-pi-extension.md
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
# doc/planning/agentic-context-management-pi-extension.md
packages/pi-plugin/agentic-context-management/
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

- `packages/pi-plugin/current-time-context/` for simple extension package metadata,
  build tasks,
  and verify task shape.
- `packages/pi-plugin/morph-compact/` for a more complex extension with commands,
  event handlers,
  and renderer helpers.
- `packages/pi-plugin/spawn/src/pi-test-harness.ts` for a fake `ExtensionAPI` harness pattern.

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

### Phase 0: regex safety gate

- Choose the exact safe regex engine through the repo's technology-selection process.
- Source-audit the finalist and at least two serious alternatives before adding a dependency.
- Do not enable regex unless the selected engine has documented linear-time behavior for supported syntax.
- Ship only literal matching if the safe-engine audit has not completed.
- Record that ACM adds no custom length,
  inspected-character,
  replacement-count,
  or active-rule caps.

Definition of done:
regex support is enabled only after a source-audited safe engine is selected,
and the implementation verifies that unsupported regex syntax is rejected clearly.

### Phase 1: minimal branch-safe omission

- Register `acm` with strict schema and shorthand compatibility.
- Implement `action: "substitute"`,
  `action: "disable"`,
  and `action: "list"`.
- Implement rule details in tool results.
- Implement `context` handler that derives rules from current `event.messages`.
- Transform assistant `TextContent.text` and non-ACM tool result `TextContent.text`.
- Support regex only when Phase 0 has selected and documented the safe engine;
  otherwise Phase 1 remains literal-only.
- Preserve tool result metadata and non-text blocks.
- Exclude `acm` tool results from eligible tool-result text.
- Add install-time and request-time diagnostics for invalid regex,
  zero current matches,
  broad `/g` matches,
  malformed details,
  unknown details versions,
  duplicate normalized matchers,
  unknown disable matchers,
  list summaries without matched snippets,
  and overlap skips.
- Add a terse custom renderer for `acm` tool calls and results.

Definition of done:
the user's example is covered by a unit test and by an extension-runner integration test.
A bad rule can be listed and disabled without editing the session file.

### Phase 2: human-facing list command

- Add `/acm-list` for the human user.
- Add richer human-facing renderer output for diagnostics.
- Add a provider-payload verification harness.

Definition of done:
human-facing commands can inspect active rules without injecting preview text into provider context.

### Phase 3: hardening after all-eligible MVP

- Tune broad-rule diagnostics after the all-eligible MVP has real fixtures.
- Consider user-approved omission of user messages or ACM's own tool results as a later explicit opt-in.
- Decide whether old `acm` tool results should themselves be compacted into a smaller custom message.

Definition of done:
the extension can compress older assistant and eligible tool context without risking user instruction loss.

## Tests to write before implementation is declared complete

Unit tests:

- shorthand input normalizes to strict schema;
- shorthand regex keys parse escaped slashes correctly;
- shorthand keys that do not start with `/` normalize to literal matchers;
- invalid slash-regex shorthand keys are rejected;
- invalid action is rejected;
- regex flags outside the allowlist are rejected;
- duplicate regex flags are rejected;
- regex flags are canonicalized into sorted order for matcher equality;
- empty description renders `<omitted></omitted>`;
- description text escapes `<`,
  `>`,
  and `&` before insertion into the omitted tag;
- substitutions transform assistant text blocks and non-ACM tool result text blocks;
- ACM tool result text remains unchanged even when a broad rule would match;
- tool result `details`,
  `toolName`,
  `toolCallId`,
  `isError`,
  and image blocks remain unchanged;
- user messages remain unchanged;
- tool call blocks remain unchanged;
- errored ACM tool results are ignored during replay;
- overlapping replacements skip deterministically;
- later rule matching cannot match inside an earlier omitted marker;
- disabled rule no longer applies;
- zero-current-match substitutions install active rules with warnings;
- a zero-current-match rule applies later when matching eligible context appears;
- malformed ACM details are ignored safely;
- unknown ACM details versions are ignored safely;
- duplicate normalized matchers replace the prior active rule and move to latest order;
- disabling an unknown matcher is a no-op with diagnostics;
- disabling a matcher removes every active rule with that normalized matcher;
- adding a matcher after disabling it reactivates that matcher for later context;
- `action: "list"` returns normalized matchers that can be copied into `action: "disable"`;
- `action: "list"` reports current assistant and tool-result match counts without matched text snippets;
- `action: "substitute"` and `action: "disable"` return provider-visible matcher summaries without snippets;
- multiple substitutions in one ACM call apply in stable order;
- global zero-width regex cannot infinite-loop;
- regex flags parser rejects unsupported flags;
- no ACM-specific length cap rejects descriptions,
  literals,
  or patterns;
- compaction boundary makes a rule inactive when its source `acm` tool result is absent from `event.messages`;
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
and require list diagnostics plus exact-matcher disable.

Risk:
a broad pattern omits too much.

Mitigation:
list commands,
immediate disable,
`/g` semantics,
and deterministic skip behavior for ambiguous matches.

Risk:
regex matching hangs the extension.

Mitigation:
ship literal matching until Phase 0 selects a source-audited safe regex engine.

Risk:
no ACM-specific caps means large context and many active rules can still cost CPU.

Mitigation:
use a documented-linear safe regex engine,
keep matching deterministic and side-effect-free,
and rely on list diagnostics plus exact-matcher disable for operational recovery.

Risk:
tool arguments duplicate the text being removed.

Mitigation:
prefer regex selectors for large spans,
and keep literal matching for exact phrases when that cost is acceptable.

Risk:
other extensions observe different context than ACM expects.

Mitigation:
document that ACM makes no load-order guarantee,
keep ACM's transformer pure,
and add tests where context handlers run before and after ACM.

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
The implementation must preserve tool metadata and provide list diagnostics with current match counts.

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
ACM should support safe-engine regex.
User answered this on 2026-06-15.

Pros:
supports the requested `/^As.+model,$/gm` shorthand path,
keeps flexible selectors for recurring boilerplate and long tool output,
and avoids unsafe JavaScript `RegExp` execution.

Cons:
some regex syntax may be rejected by the selected safe engine,
and implementation must source-audit that engine before enabling regex by default.

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
safe-engine regex beats literal-only because it preserves the requested example while controlling hangs.
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
rule details are visible to the extension and transcript UI,
but model-visible diagnostics must be summarized in tool result content.

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
Hybrid state beats custom entries because at least the tool result remains the transcript-visible audit trail.

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
List diagnostics and current match counts become mandatory.

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
rules persist on the active branch until disabled,
with Pi compaction as an expiration boundary if it removes the source `acm` tool result from provider context.
User answered the base lifetime on 2026-06-15,
then answered the compaction boundary in Question 13.

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
so list,
disable,
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
regex `/g` rewrites all matches across eligible text blocks,
regex without `/g` rewrites one match across eligible text blocks,
and literal matching rewrites one span across eligible text blocks by default.
User answered this on 2026-06-15.

Pros:
matches common regex replacement semantics,
keeps the shorthand easy to understand,
and avoids a second count-like parameter after rejecting expected match counts.

Cons:
`/g` can omit many spans if the pattern is broad,
so list,
disable,
and safe-engine matching carry the safety burden.

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

### Question 8: should ACM have previous, recent, and all-prior target scopes?

Decision:
ACM should not have previous,
recent,
or all-prior target scopes.
Every active rule scans all eligible provider-context text until disabled or expired by compaction.
User answered this on 2026-06-15:
"Why do we even have previous_* and recent_* ?
 Don't the rules apply to everything?
"
Then the user chose the all-eligible model.

Pros:
simpler schema,
no anchoring drift,
no recent-window definition,
and a closer match to the intended model that rules manage all eligible context.

Cons:
broad regex mistakes have a larger blast radius,
so list and disable must be available in the first usable version.

Rejected alternative:
keep previous,
recent,
and all-prior target scopes.

Pros:
smaller blast radius for one-off rewrites.

Cons:
requires anchoring,
recent-boundary semantics,
and more tests for surprising drift.

Rejected alternative:
keep only role filters,
for example assistant text,
tool result text,
or both.

Pros:
preserves some safety with less complexity than previous and recent windows.

Cons:
still requires schema and diagnostics that the all-eligible model does not need.

Ranking:
all-eligible beats role filters because it matches the user's mental model and removes target complexity.
Role filters beat previous and recent scopes because role-level filtering avoids anchoring drift.

### Question 9: should ACM rules apply immediately or require dry-run first?

Decision:
rules apply immediately after a successful `acm` tool call.
User answered this on 2026-06-15.
Separate `list` diagnostics still exist,
but they are not prerequisites.

Pros:
matches agentic tool-call control,
keeps the loop fast,
and avoids turning every context rewrite into a two-step ceremony.

Cons:
a bad broad `/g` rule affects the next provider request before the model inspects list output.

Rejected alternative:
require a dry-run tool call before an apply tool call.

Pros:
forces visibility into broad rewrites.

Cons:
doubles tool calls and token noise for the common case.

Rejected alternative:
require human approval for broad rewrites.

Pros:
strongest guard for broad rewrites.

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
"It's just a string models pass to the toolcall.
 And in js/json strings can be empty.
"

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
install-time diagnostics live in the current `acm` tool result `details`
and are summarized compactly in that tool result `content`.
Request-time diagnostics are recomputed through `action: "list"`
and `/acm-list`,
without injecting extra context messages or mutating older tool result details.
User answered the placement on 2026-06-15;
the install-time versus request-time split follows from the non-destructive `context` hook boundary.

Pros:
keeps diagnostics auditable without adding hidden prompt tokens on every provider request.
Tool result content carries compact model-visible summaries when needed,
while details remain the replay source for the extension.

Cons:
the model must inspect tool result content or call `list` to notice skipped or broad rewrites.
Content summaries also cost a small number of tokens.

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

Decision:
ACM rewrites provider context only.
The transcript UI and session JSONL keep the original text plus ACM audit trail.
User answered this on 2026-06-15.

Pros:
maximal auditability,
matches Pi's `context` event boundary,
and avoids confusing `/tree` or resume behavior.

Cons:
the human may still see large original tool outputs in the transcript UI unless normal tool-collapse UI hides them.

Rejected alternative:
also render omitted markers in the UI while keeping JSONL original.

Pros:
human view matches model view.

Cons:
adds a parallel renderer path and may hide useful audit details from visual review.

Rejected alternative:
rewrite session history destructively.

Pros:
every surface matches the omitted context.

Cons:
loses evidence and breaks the core non-destructive design.

Ranking:
provider-only beats UI-mirrored because the context hook's strength is non-destructive request-time rewriting.
UI-mirrored beats destructive history rewrite because original evidence remains recoverable.

### Question 13: should ACM rules survive Pi compaction?

Decision:
rules expire when their source `acm` tool results fall behind Pi compaction.
User answered this on 2026-06-15.

Pros:
simplest context handler,
keeps replay based on the same `event.messages` provider-context surface that ACM rewrites,
and treats Pi compaction as a natural reset boundary.

Cons:
compaction can disable active ACM rules before an explicit `disable` action.
This narrows the persist-until-disabled decision to uncompacted provider context.

Rejected alternative:
rules survive compaction until explicitly disabled.
The implementation would replay rule actions from `ctx.sessionManager.getBranch()` rather than only `event.messages`,
because `event.messages` may contain a compaction summary instead of older `acm` tool results.

Pros:
respects persist-until-disabled across automatic and manual compaction.

Cons:
the `context` handler has to reconcile branch entries with provider messages,
which is more complex than scanning `event.messages` alone.

Rejected alternative:
write a fresh ACM state entry during compaction.

Pros:
keeps post-compaction replay short.

Cons:
creates a second state materialization path that can diverge from tool result replay.

Ranking:
expire-on-compaction beats survive-via-branch-replay because the user prefers the simpler natural reset boundary.
Survive-via-branch-replay beats fresh state because tool result details remain the single source of truth.

### Question 14: what should Phase 0 require before regex is enabled?

Decision:
Phase 0 should choose a source-audited safe regex engine with documented linear-time behavior.
User answered this on 2026-06-15.
The exact dependency remains unchosen until Phase 0 runs the repo's technology-selection process.

Pros:
preserves regex power for shorthand patterns,
gives a clearer safety proof than hand-rolled syntax checks,
and avoids relying on timeout behavior for every request.

Cons:
requires dependency-selection work,
source auditing,
and possibly a supported syntax subset that differs from JavaScript `RegExp`.

Rejected alternative:
wrap JavaScript `RegExp` in an abortable worker.

Pros:
preserves JavaScript regex semantics.

Cons:
adds worker overhead,
timeout tuning,
and lifecycle complexity.

Rejected alternative:
accept only a restricted JavaScript regex syntax.

Pros:
avoids adding a dependency.

Cons:
hand-rolled regex safety is easy to under-specify and test poorly.

Rejected alternative:
ship literal matching first and defer regex.

Pros:
safest initial implementation.

Cons:
does not support the user's shorthand example until later.

Ranking:
safe engine beats abortable worker because documented linear-time matching is a stronger default safety boundary.
Abortable worker beats restricted syntax because preserving regex semantics is more useful than a fragile local parser.
Restricted syntax beats literal-only because it can still support some regex shorthand.

### Question 15: how should ACM disable persistent rules?

Decision:
ACM should disable rules by exact normalized matcher rather than by rule id.
User answered this on 2026-06-15 after asking why ACM needs rule IDs at all.

Pros:
removes generated-ID lifecycle semantics,
keeps the public tool call tied to the same matcher the model installed,
and avoids ordinal drift.

Cons:
selective disable is less precise when several active rules share the same matcher with different descriptions;
those rules are disabled together.

Rejected alternative:
extension-generated stable rule IDs.

Pros:
precise selective disable after `list`.

Cons:
requires ID generation,
duplicate handling,
and a separate identifier surface the user questioned.

Rejected alternative:
clear all active rules.

Pros:
simplest escape hatch and no selector semantics.

Cons:
removes useful rules along with the bad rule,
forcing the model to re-add them.

Rejected alternative:
list ordinals.

Pros:
concise and no stored IDs.

Cons:
ordinals can drift after compaction,
branching,
or earlier disables.

Ranking:
exact matcher beats generated IDs because it keeps disable semantics tied to the rule's actual selector.
Generated IDs beat clear-all because they preserve precise selective disable.
Clear-all beats ordinals because it is blunt but not drift-prone.

### Question 16: what should `action: "list"` return?

Decision:
`action: "list"` should return matcher summaries without matched text snippets.
User answered this on 2026-06-15.

Each summary should include:

- normalized matcher,
- description,
- source `toolCallId`,
- creation order,
- current assistant-text match count,
- current tool-result-text match count,
- skip diagnostics.

Pros:
lets the model copy exact normalized matchers into `action: "disable"`,
keeps diagnostics compact,
and avoids putting omitted text back into provider context.

Cons:
visual audit requires session inspection rather than list snippets.

Rejected alternative:
include matched snippets in `action: "list"`.

Pros:
easier to inspect what will be omitted.

Cons:
can reintroduce large or intentionally omitted text into context.

Rejected alternative:
return counts only.

Pros:
smallest diagnostic output.

Cons:
does not support exact-matcher disable without retyping matchers from memory.

Ranking:
matcher summary beats snippets because disable needs normalized matchers and list should stay compact.
Snippets beat counts-only for human audit,
but counts-only is too weak for the exact-matcher disable contract.

### Question 17: should ACM include a preview surface?

Decision:
ACM should not include preview in the MVP.
User answered this on 2026-06-15.

Pros:
smallest diagnostic surface,
avoids duplicating omitted text into tool results or UI command output,
and keeps implementation focused on the request-time transformer plus list diagnostics.

Cons:
debugging broad rewrites depends on matcher summaries,
current match counts,
and inspecting the original transcript.

Rejected alternative:
human-only `/acm-preview`.

Pros:
lets the user inspect transformed context without adding preview text to model context.

Cons:
adds another command and renderer surface.

Rejected alternative:
model-callable preview action.

Pros:
lets the model self-audit exact request-time rewrites.

Cons:
can duplicate large or intentionally omitted text back into provider context.

Ranking:
no preview beats human-only preview because the user wants the smaller surface.
Human-only preview beats model preview because it avoids adding preview payloads to model context.

### Question 18: should zero-current-match substitutions install rules?

Decision:
zero-current-match substitutions should install active rolling rules with warnings.
User answered this on 2026-06-15.

Pros:
supports future-oriented context management,
keeps rolling-rule semantics consistent,
and surfaces possible typos through diagnostics.

Cons:
stale typo rules can persist until disabled.

Rejected alternative:
reject zero-current-match substitutions.

Pros:
catches likely typos before a rule becomes active.

Cons:
prevents rules intended to catch future matching context.

Rejected alternative:
install zero-current-match substitutions silently.

Pros:
simplest tool output.

Cons:
hides misspelled patterns and makes bad rules hard to notice.

Ranking:
install-with-warning beats reject because rolling rules can intentionally match future context.
Reject beats silent install because surfacing likely mistakes matters.

### Question 19: what happens when a matcher is added twice?

Decision:
adding a normalized matcher that is already active should replace the prior active rule.
The replacement gets the new description,
source `toolCallId`,
and latest creation order.
User answered this on 2026-06-15.

Pros:
lets the model update descriptions or refresh provenance without rule IDs,
avoids duplicate overlap noise,
and keeps exact-matcher disable unambiguous.

Cons:
re-adding a matcher changes provenance and rule order.

Rejected alternative:
reject duplicate normalized matchers.

Pros:
catches accidental repeated rules.

Cons:
updating a description requires a disable call followed by a substitute call.

Rejected alternative:
keep the first active rule.

Pros:
preserves original provenance.

Cons:
a later substitute appears to succeed but changes nothing.

Rejected alternative:
allow duplicate active rules.

Pros:
pure event-log replay with no dedupe.

Cons:
duplicate matches overlap,
add diagnostics noise,
and exact-matcher disable removes all copies anyway.

Ranking:
replace beats reject because it supports updating rules without IDs.
Reject beats keep-first because explicit failure is clearer than a no-op substitute.
Keep-first beats duplicates because duplicate active rules create overlap noise.

### Question 20: what does exact normalized matcher mean?

Decision:
matcher equality is the canonical tuple of `kind`,
exact `value`,
and sorted unique `flags` for regex matchers.
Unsupported or duplicate flags are rejected rather than normalized silently.
No deeper regex semantic equivalence is attempted.
User answered this on 2026-06-15.

Pros:
`/x/gi` and `/x/ig` disable the same rule,
duplicate and unsupported flags fail early,
and equality stays independent of safe-engine internals.

Cons:
semantically equivalent regex forms with different source text are still different matchers.

Rejected alternative:
raw string equality.

Pros:
simplest implementation.

Cons:
flag order makes disable brittle.

Rejected alternative:
semantic regex equivalence.

Pros:
could treat equivalent regex forms as the same matcher.

Cons:
costly,
safe-engine-specific,
and hard to prove correct.

Ranking:
canonical tuple beats raw string because flag-order differences should not break disable.
Raw string beats semantic equivalence because it is simple and predictable.

### Question 21: how should shorthand map keys parse?

Decision:
shorthand map keys that start with `/` parse as `/pattern/flags` regex matchers;
all other keys parse as literal matchers.
User answered this on 2026-06-15.
Invalid slash-regex keys are rejected rather than falling back to literal matching.
Literal strings shaped like slash-regex keys must use the strict schema.

Pros:
supports the user's regex shorthand,
keeps concise literal shorthand,
and rejects likely malformed regex typos.

Cons:
a literal that begins with `/` and resembles regex syntax needs the strict schema.

Rejected alternative:
regex-only shorthand keys.

Pros:
every shorthand key has one parsing rule.

Cons:
simple exact-text omission needs verbose strict schema.

Rejected alternative:
strict schema only.

Pros:
no ambiguous shorthand parsing.

Cons:
the shorthand map becomes much less useful.

Ranking:
slash-regex-else-literal beats regex-only because literal shorthand is useful and unambiguous for non-slash keys.
Regex-only beats strict-only because it still supports the user's concise regex example.

### Question 22: what should substitute and disable tool result content include?

Decision:
`substitute` and `disable` tool result content should include compact matcher summaries without matched snippets.
User answered this on 2026-06-15.

Each summary should include:

- normalized matcher,
- description for added rules,
- action result,
- current match counts,
- warnings.

Pros:
keeps exact-matcher disable usable from provider-visible context,
surfaces zero-match and duplicate-replacement warnings,
and avoids putting matched text snippets back into context.

Cons:
costs more tokens than a terse success result.

Rejected alternative:
return counts only.

Pros:
smaller provider-visible result.

Cons:
the model cannot copy exact matchers from install output into `disable`.

Rejected alternative:
return only a terse success status.

Pros:
lowest token cost.

Cons:
hides warnings and selector details from the model.

Ranking:
matcher summaries beat counts-only because exact-matcher disable needs provider-visible selectors.
Counts-only beats terse success because counts at least reveal broad or zero matches.

### Question 23: should ACM define custom caps?

Decision:
ACM should not define custom caps for description length,
literal length,
regex pattern length,
inspected text,
replacement count,
or active rules.
User answered this on 2026-06-15 by saying "No caps.
"

Pros:
avoids arbitrary limits,
keeps model-authored selectors expressive,
and lets Phase 0 focus on selecting a safe regex engine rather than tuning constants.

Cons:
large descriptions,
literals,
or many active rules can still cost tokens or CPU within the existing provider context window.
List diagnostics and exact-matcher disable must carry the operational safety burden.

Rejected alternative:
choose exact constants during Phase 0.

Pros:
turns safety limits into concrete implementation requirements.

Cons:
requires arbitrary policy choices after the user rejected caps.

Rejected alternative:
make caps configurable.

Pros:
lets users tune different sessions.

Cons:
adds config schema,
validation,
and more failure modes.

Rejected alternative:
hardcode starter caps now.

Pros:
more immediately implementation-ready.

Cons:
most arbitrary option.

Ranking:
no caps beats Phase 0 constants because it matches the user's stated preference.
Phase 0 constants beat configurable caps because they keep the surface smaller.
Configurable caps beat hardcoded starter caps because at least users can adjust them.

### Question 24: what load-order guarantee should ACM make?

Decision:
ACM should make no guarantee about running before or after other context-mutating extensions.
User answered this on 2026-06-15.

Pros:
simplest packaging,
honest about Pi extension composition,
and avoids depending on global extension-order control.

Cons:
users can get different final provider context depending on extension load order.

Rejected alternative:
recommend loading ACM last.

Pros:
ACM omissions apply near the final provider payload.

Cons:
earlier handlers can still remove ACM tool results before replay,
and the guarantee depends on user configuration outside the package.

Rejected alternative:
recommend loading ACM first.

Pros:
later handlers can observe omitted markers.

Cons:
later handlers can reintroduce text or invalidate ACM diagnostics.

Ranking:
no guarantee beats run-last because it matches the user's preference and avoids promising order control.
Run-last beats run-first because final-payload shaping is more useful than marker visibility to later handlers.

## Resolved implementation decisions

Question 1 is resolved:
assistant text and tool result text are both in scope.
Question 2 is resolved:
safe-engine regex is in scope,
while raw JavaScript `RegExp` over full context is out of scope.
Question 3 is resolved:
active rules live in `acm` tool result `details`.
Question 4 is resolved:
all non-ACM tool result text blocks are eligible,
with ACM's own tool results excluded.
Question 5 is resolved:
rules persist on the active branch until disabled,
with Pi compaction as an expiration boundary if it removes the source `acm` tool result from provider context.
Question 6 is resolved:
rules do not include expected match counts.
Question 7 is resolved:
regex `/g` rewrites all matches across eligible text blocks,
regex without `/g` rewrites one match across eligible text blocks,
and literal matching rewrites one span across eligible text blocks by default.
Question 8 is resolved:
ACM has no previous,
recent,
or all-prior target scopes;
rules scan all eligible provider-context text until disabled or expired by compaction.
Question 9 is resolved:
rules apply immediately after a successful `acm` tool call.
Question 10 is resolved:
descriptions are model-supplied strings,
and empty strings are valid.
Question 11 is resolved:
install-time diagnostics live in current `acm` tool result `details`
and compact current tool result `content`,
and request-time diagnostics are recomputed through `list` commands.
Question 12 is resolved:
ACM rewrites provider context only.
Question 13 is resolved:
rules expire when Pi compaction removes their source `acm` tool results from provider context.
Question 14 is resolved:
Phase 0 requires a source-audited safe regex engine before enabling regex.
Question 15 is resolved:
ACM disables rules by exact normalized matcher rather than by rule id.
Question 16 is resolved:
`action: "list"` returns matcher summaries without matched text snippets.
Question 17 is resolved:
ACM has no preview surface in the MVP.
Question 18 is resolved:
zero-current-match substitutions install active rules with warnings.
Question 19 is resolved:
adding an already active normalized matcher replaces the prior active rule.
Question 20 is resolved:
exact normalized matcher means `kind`,
 exact `value`,
 and sorted unique regex `flags`.
Question 21 is resolved:
shorthand keys parse as slash-regex when they start with `/`,
 otherwise as literals.
Question 22 is resolved:
`substitute` and `disable` tool result content include compact matcher summaries without snippets.
Question 23 is resolved:
ACM defines no custom caps for descriptions,
 literals,
 patterns,
 inspected text,
 replacements,
 or active rules.
Question 24 is resolved:
ACM makes no load-order guarantee relative to other context-mutating extensions.
Before implementation,
run the documented Phase 0 source audit to choose the exact safe regex engine.
