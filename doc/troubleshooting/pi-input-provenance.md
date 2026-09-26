# Pi 0.87.1 user-role messages do not preserve input-channel provenance

## Symptom and relevance

An auto-mode authorization collector must not equate a user-role transcript message with human authorization.
Pi 0.87.1 distinguishes input channels during its input event,
but ordinary message construction does not retain that source field.
A programmatic prompt without an explicit source defaults to `interactive`.
Input transforms can also alter text while retaining the channel label.

This is relevant to the axiom migration because models may match an effect against a trusted human request,
but cannot establish who authored a message from its prose or role.
The user already requires this distinction.
No production collector or SDK patch has been implemented.

## Source identity

Installed package: `@earendil-works/pi-coding-agent@0.87.1`.
Upstream repository: <https://github.com/earendil-works/pi>.
Tag `v0.87.1` resolves to `f07218c4d4bbc12bef056a7058c3dd49dfe41abe`.
Read-only clone: `~/temp/agent/pi-input-provenance-2026-09-26`.
The cloned license is MIT.

The probe uses inspected compiled method bodies from the installed package,
not an SDK startup command.
Copied `dist/core/agent-session.js` SHA-256:
`5ebfae51db5a900596145159428e7cb57d195af9d54a28f41d4ac8ff1bfd5729`.
Copied `dist/core/extensions/runner.js` SHA-256:
`67c7ca2d24197ff46cb5f0a49d7c19a76825ab7c66bc942015a484b550396441`.
Source paths in this document are relative to the pinned clone.
No upstream source was changed.

The installed extension,
SDK,
message-type,
and session-format documentation and input-transform example were read.
The upstream input-event and session-context-edit tests were inspected,
not executed as complete suites.

## Root cause trace

### Source is supplied to input handlers, not automatically authenticated

`packages/coding-agent/src/core/agent-session.ts:1633-1639`
passes the caller option or a default to input handlers:

```typescript
// packages/coding-agent/src/core/agent-session.ts:1633-1639, selected arguments
const processedInput = await this._runInputHandlers(
  text,
  options?.images,
  options?.source ?? "interactive",
  this.isStreaming ? options?.streamingBehavior : undefined,
);
```

The source tag describes the supplied channel.
Its default is not proof that a person typed the submitted string.
A trusted host may establish that separately at its own input interface;
the model must not infer it from the label.

The official extension submission path at `agent-session.ts:2029-2035`
explicitly supplies `source: "extension"`:

```typescript
// packages/coding-agent/src/core/agent-session.ts:2029-2035
await this.prompt(text, {
  expandPromptTemplates: options?.expandPromptTemplates ?? false,
  streamingBehavior: options?.deliverAs,
  images,
  source: "extension",
});
```

That input still becomes a user-role message.
A source distinction in the transient event does not imply a source distinction in the message object.

### Message construction omits the source field

At `agent-session.ts:1724-1728`,
the constructed message contains role,
content,
and time:

```typescript
// packages/coding-agent/src/core/agent-session.ts:1724-1728
messages.push({
  role: "user",
  content: userContent,
  timestamp: Date.now(),
});
```

The provider-facing `UserMessage` declaration at `packages/ai/src/types.ts:509`
also has no source member.
The installed session-format documentation defines message entries as storing `AgentMessage`.
This does not rule out a separate application-owned provenance ledger;
it rules out recovering a unique input source from this constructed message alone.

With a fixed clock and identical text,
the actual inspected method produced indistinguishable message objects
for explicit `interactive` and `extension` inputs.
The callback-source positive control still distinguished them.
The same loss was observed through the queued extension follow-up method.
No real session file was written by this probe.

### Transforms retain the input channel label

`packages/coding-agent/src/core/extensions/runner.ts:1412-1457`
chains input handlers.
Each receives the current transformed text and the same source parameter:

```typescript
// packages/coding-agent/src/core/extensions/runner.ts:1424-1436, selected statements
const event: InputEvent = {
  type: "input",
  text: currentText,
  images: currentImages,
  source,
  streamingBehavior,
};
currentText = result.text;
currentImages = result.images ?? currentImages;
```

In the offline control,
an earlier handler appended `AUTOMATED_ADDITION`.
A later handler received that modified body with source still `interactive`,
and the altered text entered the constructed user message.
A late collector must not certify the transformed body as untouched human text merely from this label.

### Throwing from an input collector does not veto prompt delivery

The same method catches handler exceptions,
reports them through `emitError`,
and continues its handler loop.
If no handler changes or handles the input,
it returns `continue`.
The offline error control recorded one collector error and still constructed one user message.

A collector therefore needs an explicit unresolved-origin state that the guarded-action policy checks.
Do not rely on an input-handler exception to prevent later actions.
A missing witness must not silently promote the new text or stale authorization.
This is a proposed consumer requirement,
not a verified collector implementation.

## Verification

Private harness: `~/temp/agent/pi-input-provenance-probe-2026-09-26`.
It extracts the inspected compiled methods using checked unique boundaries
and executes those bodies in a VM with explicit host-service doubles.
It does not import the full SDK modules,
load extensions from the real home,
request provider credentials,
or call a model.

```sh
# Private method-level fixture harness.
cd -- "${HOME}/temp/agent/pi-input-provenance-probe-2026-09-26"
mise --no-env --no-hooks run build
mise --no-env --no-hooks run probe
```

Base image: `bbc51c187ec813fd7c6a49afd22c15efdfe969b8c3a9a9cd49193c8a03908984`.
Probe image: `104fe7d55d74ad816462178c6ee0f2e239f5daefd037b50f1c0ebae5df354019`.
The Containerfile uses COPY only.
Runtime bounds are 2 GiB memory including swap allowance,
2 CPUs,
64 PIDs,
256 file descriptors,
60 seconds,
and a 256 MiB Node heap.
No network,
host mounts,
real credentials,
or writable host state is present.
Process `proc_9199` exited 0.

### Working controls

- Explicit input source values are visible to input callbacks.
- Extension submission supplies the extension source tag.
- Normal prompt delivery and queued delivery produce user-role messages.
- Input transforms reach later handlers and the constructed message.
- Input-handler errors reach the error callback.

### Rejected provenance assumptions

- User role identifies a human author.
- `interactive` identifies a human even when supplied by a programmatic/defaulted call.
- The source field is automatically retained in the ordinary message object.
- A transformed body inherits human authorship from its channel label.
- Throwing from the input collector stops the prompt.

The source-method checks pass because they reproduce these counterexamples.
They do not verify a live TUI/RPC session,
persisted JSONL,
a deployed origin collector,
or the auto-mode consumer interface.
Those remain implementation qualification work.

## Proposed containment and unverified remedies

Treat conversational evidence without a verified witness as non-authorizing.
Explicit UI-confirmed grants and exact-action approvals remain separate authority paths.
Do not discard those paths solely because conversational origin is unresolved.

A future origin collector must bind the original admitted content to its actual session entry and branch.
Channel,
content digest,
entry identity,
and human confirmation are different fields with different meanings.
A content hash alone is not a unique message identity.
Prefer metadata references to existing session entries over duplicate transcript capture.
No new ongoing transcript capture is authorized.

Context edits can replace projected content while preserving entry role and metadata,
as described in the inspected session-format documentation and tests.
Authorization must not transfer to rewritten text merely because its original entry has a trusted witness.
The original witnessed content and later projected context need separate treatment.
This path has not yet received a local runtime probe.

No collector workaround is declared verified.
The proposed design can ask when its required authority evidence is absent,
while preserving the accepted semantic-effect policy from Q13 B.
Origin qualification is not a replacement code-proof requirement for script effects.

## What does not work

- Asking the model whether text was written by a human.
- Promoting user-role messages,
  summaries,
  tool output,
  project context,
  or automated continuations into grants.
- Assuming the defaulted source tag is an authenticated identity.
- Binding authority only to transformed text or a projected role.
- Declaring a production provenance solution from this isolated method test.

## Upstream filing artifact

No upstream issue or comment is drafted or filed.
Input transformations and provider-facing message shapes are documented host behavior,
not an established upstream defect.
No patch is proposed.

### Upstream filing decision

1.  Upstream fault: not established.
    The authorization consumer needs a stronger witness than the documented message shape provides.
2.  Fixability: no impossibility claim.
    Application-owned metadata and explicit approval interfaces remain possible integration paths.
3.  Supported use: extension input events and custom session state are documented;
    a complete human-authorization collector is not supplied by these tests.
4.  Contribution policy: not evaluated because no upstream contribution is proposed.
5.  Maintainer willingness: not evaluated;
    no request was sent.
6.  Fix prototype: none.
    The method-level counterexample harness is not a provenance fix.

Any future filing requires the exclusion,
contribution,
duplicate-search,
and tested-fix checks before a draft.
