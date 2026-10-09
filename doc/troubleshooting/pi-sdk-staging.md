# Pi 0.87.1 nominal dependency inventory rejects the configured workspace graph

## Private SDK 1.1.0 source association stops at defensive copies

### Symptom and cause

The private integration's actual-serializer control reached canonical review but reported `unresolved`
where an original source association was expected.
This was a private adapter gap,
not an upstream SDK defect.
`proc_6ab2` first exposed the absent consumer;
`proc_66a8` and `proc_d722` then isolated lost sections-object identity.

The private `contract/integration/native-batch/root-source.mjs` already copies entries on append
and copies public projections to protect native state.
Those copies intentionally replace objects.
Installed `@earendil-works/pi-coding-agent@1.1.0/dist/core/extensions/runner.js:1006`
then makes another request-context copy:

```javascript
// Installed pi-coding-agent dist/core/extensions/runner.js
async emitContext(messages) {
    const ctx = this.createContext();
    let currentMessages = structuredClone(messages);
```

Comparing bytes after these operations would not authenticate an original source.
The private owner now republishes its existing capability at the actual copy sites,
before extension transforms.
No persisted-session provenance is inferred.

Installed `@earendil-works/pi-ai@1.1.0/dist/api/openai-completions.js:188`
awaits the payload hook before handing the selected object to the client:

```javascript
// Installed pi-ai dist/api/openai-completions.js
const nextParams = await options?.onPayload?.(params, model);
if (nextParams !== undefined) {
    params = nextParams;
}
```

Installed `openai@7.19.0/client.mjs:1156` also awaits authentication before body construction:

```javascript
// Installed openai client.mjs
const authenticationHeaders = this._provider || x509Authentication
    ? undefined
    : await this.authHeaders(inputOptions, inputOptions.__security ?? { bearerAuth: true });
const { bodyHeaders, body, isStreamingBody } = this.buildBody({ options });
```

A payload-hook check alone therefore leaves an alias-mutation interval.
The private adapter copies and freezes only newly owned payload containers for the associated branch.
It does not freeze callback-owned objects or require discarded aliases to remain current after serialization.

### Verification and supported workaround

From the private repository's `contract/integration/native-batch` directory,
run `mise --no-env --no-hooks run test:serializer-association`.
It regenerates the adapter from the current installed SDK and uses local SSE responses through the actual serializer.
`proc_6043` passed its 11-mode matrix on SDK 1.1.0.
Provider requests and native tool executions were zero.

Original publication,
top-level payload replacement retaining the original message,
and discarded-alias mutation after materialization remain associated.
Equal-byte message copies,
independent sections copies,
changed text,
accessors,
serialization hooks,
extra system content,
and opaque stream wrappers acquire no association.
An observed sections mutation permanently retires the original publication.
Retirement must not block native recording of the failure itself;
`proc_1b18` exposed that private cleanup error before `7890f0c` repaired it.

The workaround is partial source association,
not complete composite-origin accounting.
Request-domain and delegation obligations still withhold canonical execution.
It adds neither a JSON parser nor another request representation.

Expanded matrix `proc_2731` passed 15 modes.
`proc_0731` first reproduced a sections accessor swapping its result between authentication and serialization.
`proc_98b2` separately reproduced the copy observer invoking a nonenumerable getter that throws `false`.
Source-bearing envelopes now require ordinary data fields;
copy observation uses descriptors and does not invoke getters.
The enumerable-getter control counts only the native clone's invocations.

`proc_3ece` compared installed and private context processing in 10 SDK sessions:
unchanged conversation,
changed conversation,
system-message replacement,
in-place mutation,
and a handler throwing `false`.
The ordered handler observations and serializer inputs matched.

Equality omission `34a0355` failed `proc_92e5`.
Owned-payload omission `8bc2eb4` failed `proc_7738` during real client body construction,
before terminal fetch.
Both omissions are restored.
Full native `proc_c4d5` and action `proc_2fa4` passed.
These results remain scoped to the explicit fixed serializer and current-run publication,
not the default model-runtime wrapper or general history provenance.

### Retained forced and custom-section inputs

The private consumer separately lacked forced-prompt and custom-section links.
Actual-serializer checks `proc_84e0` and `proc_ff08` failed with `AssertionError [ERR_ASSERTION]`
at the required original-source association assertions.
The captured source text already existed;
adding another source inventory or JSON parser would not supply the missing publication lineage.

The existing run owner now records the actual forced-message projection.
Its source does not inherit a displaced host source's authority,
even when their text is equal.
Identity omission `c316f17` failed `proc_305b` by associating an independent equal-byte message copy.
After restoration,
full native `proc_38d6` and action `proc_3eaf` passed.

Installed Pi SDK 1.1.0 `dist/core/system-prompt.js:97` first assigns appended and project-context text.
Its custom-section override at `dist/core/system-prompt.js:111` then replaces only truthy values:

```javascript
// Installed pi-coding-agent dist/core/system-prompt.js:111
for (const [name, content] of Object.entries(customSections)) {
    if (content)
        promptSections[name] = content;
}
```

Consequently,
a retained base or run-replacement input does not contribute when a nonempty custom section displaces it.
An empty custom value does not remove the original section.
The private adapter consumes existing `mappedPromptInputs` only through their original run,
source membership,
and full sections publication.
`contract/collector/run-prompt-custody-v3/owner.mjs:211` binds the published options to the captured render:

```javascript
// Private contract/collector/run-prompt-custody-v3/owner.mjs:211
if(scope.rendered&&(scope.rendered.options!==(scope.delivery??scope.working)||!isDeepStrictEqual(scope.rendered.input,options)))throw new SourceCollectionError('Native run publication differs from its original prompt construction inputs');
```

From private `contract/integration/native-batch`,
`mise --no-env --no-hooks run test:section-source-association` passed `proc_49c5` with 18 modes.
These cover additions,
base and run-replacement shadowing,
empty overrides,
forced precedence,
independent copies,
malformed Unicode,
native-default rendering,
and invalid section names.
From private `contract/integration/action-policy`,
`mise --no-env --no-hooks run test:source-association` passed `proc_73fc` for original capabilities and map bounds.

Removing native shadowing failed `proc_30bf` by crediting displaced project-context text.
Removing source membership initially failed on an unrelated source shape in `proc_d146`;
that result did not demonstrate false admission.
Refined omission `fa5432b` failed `proc_cb23` with `nonmember`,
reporting `accounted` instead of `unresolved`.
Both guards are restored.
Full native `proc_744b`,
action `proc_09ee`,
and ten-document render `proc_fed3` passed.

This remains partial lineage at a containing serialized field,
not complete request-origin accounting or instruction authority.
Non-transmission does not revoke separately established governing instructions.
The private adapter still withholds execution on independent missing premises.
The existing filing disposition applies:
these are private-consumer gaps,
not defects in native copying or native override behavior.

### Native skill-guidance whitespace is transformed before publication

SDK 1.1.0 `dist/core/skills.js:283` constructs the guidance with leading blank lines:

```javascript
// Installed pi-coding-agent dist/core/skills.js:283
const lines = [
    "\n\nThe following skills provide specialized instructions for specific tasks.",
```

Its caller in `dist/core/system-prompt.js:106` trims the complete skills section:

```javascript
// Installed pi-coding-agent dist/core/system-prompt.js:106
const skillsPrompt = formatSkillsForPrompt(skills, skillFileReadTool).trim();
```

The retained guidance source therefore differs from the rendered prefix's leading whitespace.
The private association follows this known native transformation through the original full sections publication;
it does not rewrite the retained source or authenticate it by substring equality.
Test-only terminal parity checks the trimmed prefix separately from original-capability checks.

Private `mise --no-env --no-hooks run test:context-skill-source`
in `contract/integration/native-batch` failed `proc_0f4b` on the absent project-context introduction association,
then passed `proc_0500` after both introduction and skill-guidance links were added.
The expanded `test:section-source-association` matrix passed `proc_edd5` with 32 modes,
including read/bash guidance,
disabled skills,
no reader,
section overrides,
forced output,
and equal payload copies.
No provider request or native tool execution occurred.

This does not associate arbitrary skill-file contents or establish their authority.
Default-rule fragments use separate normalization/deduplication emission evidence,
not this whitespace-transformation profile.
Native trimming is expected behavior;
only private source consumption needed extension,
so there is no upstream defect or filing artifact.

### Default-rule construction can precede deduplication

SDK 1.1.0 `dist/core/system-prompt.js:34` normalizes and deduplicates each rule before appending it:

```javascript
// Installed pi-coding-agent dist/core/system-prompt.js:34
const addRule = (rule) => {
    const normalized = rule.trim();
    if (!normalized || seen.has(normalized))
        return;
    seen.add(normalized);
    rules.push(normalized);
};
```

The private recorder previously retained each constructed default literal before calling `addRule`.
That established construction,
not contribution to the serialized rules section.
An independent guideline could already have supplied identical text.

The fixed private recorder now observes the original local array length around the untouched native call:

```javascript
// Private builder-source.mjs: generated addBuiltInRule instrumentation.
const before = rules.length;
addRule(rule);
recordGenerated({
    slot: "default-rule",
    content: rule,
    nativeRuleInsertion: rules.length > before ? "inserted" : "not-inserted",
});
```

The existing render-input owner accepts this optional enum only as an own string data field on a default rule.
It freezes the fact on the existing original source.
No source is dropped from instruction assessment when its addition was suppressed.
Producer and consumer both require `inserted` for a contribution,
with the original run/render/source/publication checks and later override handling unchanged.

Private native task `test:native-rule-source` failed `proc_ed24` before the consumer existed,
then passed `proc_bfe3`.
The expanded rendering matrix passed `proc_a236` with 38 modes.
Its extra task names were forwarded as arguments rather than running builder/owner checks;
corrected separate invocations passed `proc_4b3c`.
See [mise task argument forwarding](mise-usage-args-inline-node.md#additional-task-names-can-be-forwarded-as-ordinary-arguments).

Producer omission `2885c7d` failed `proc_3a5c` with `1 !== 0`
for a fabricated suppressed-source contribution.
Consumer omission `39c6c44` failed `proc_1fd3` by reporting `accounted` instead of `unresolved`
for `rule-not-inserted`.
Both guards are restored.
Full native `proc_a618`,
action `proc_412e`,
and eleven-document render `proc_d1a5` passed.
The underlying native deduplication was correct;
this was a private source-consumption gap,
not an upstream defect or a reason to infer authority from equal bytes.

### Tool snippet rendering follows the actual prepared loadout

SDK 1.1.0 `dist/core/agent-session.js:1306` replaces the prompt's hidden-tool list during native preparation:

```javascript
// Installed pi-coding-agent dist/core/agent-session.js:1306
options.hiddenTools = [...this._hiddenDeclarations];
```

The list comes from actual `prepareLoadout` hook results collected at `dist/core/agent-session.js:1182`.
Editing only the earlier handler's `systemPromptOptions.hiddenTools` would not exercise that native outcome.
The private fixture uses the hook and checks the original final options,
without changing native loadout behavior.

In `dist/core/system-prompt.js:76`,
declared tools exclude hidden names.
Inside native-default rendering,
the tools section then uses only declarations with nonempty snippets:

```javascript
// Installed pi-coding-agent dist/core/system-prompt.js:84
const visibleTools = declaredTools.filter((name) => !!toolSnippets[name]);
```

The source consumer now accounts for the existing original mapped snippet occurrence only on that route.
Custom prompts,
inactive or hidden tools,
empty snippets,
a tools-section override,
or forced output do not receive that snippet association.
A hidden read tool can still produce indirect skill guidance;
that distinct native behavior is preserved rather than treating hidden declarations as unavailable callables.

Actual-serializer red `proc_9121` preceded green `proc_04cd`.
Expanded snippet/hidden-reader matrix `proc_4f4e` and consumer-owner controls `proc_43a1` passed.
The controls include independent equal active/inactive snippets,
whitespace,
empty overrides,
and payload copies.
Hidden-declaration omission `2fdd453` failed `proc_882a`;
selected-tool omission `5943e0f` failed `proc_d76d`.
Both incorrectly associated a non-rendered source and both are restored.
Full native `proc_18cf`,
action `proc_7c12`,
and eleven-document render `proc_3594` passed.

Tool names and native declaration placement still supply no source authority,
implementation-effect proof,
or governing-domain completeness.
The native loadout and rendering behavior was not defective;
only the private consumer lacked these source relationships.
There is no upstream filing artifact.

### Skill descriptions retain original sources through XML escaping

SDK 1.1.0 selects a native read/bash or indirect reader before rendering skills
in `dist/core/system-prompt.js:103`.
Its formatter excludes disabled entries at `dist/core/skills.js:279`:

```javascript
// Installed pi-coding-agent dist/core/skills.js:279
const visibleSkills = skills.filter((s) => !s.disableModelInvocation);
```

The emitted description uses the native XML encoder:

```javascript
// Installed pi-coding-agent dist/core/skills.js:297
lines.push(`    <description>${escapeXml(skill.description)}</description>`);
```

The private consumer now links existing original skill-description sources through that known rendering.
It does not parse metadata into a second inventory,
rewrite the retained description,
or infer the referenced file's identity or instruction authority.
An enabled empty description still creates native XML markup,
but no contribution from description text.
Equal enabled descriptions remain separate original occurrences.

Actual-serializer red `proc_f07f` preceded green `proc_cd76`.
Expanded matrix `proc_1cc5` passed 55 modes,
including native read/bash/indirect readers,
disabled and empty descriptions,
section and forced overrides,
independent copies,
and equal enabled descriptions.
The adversarial description contains closing-tag delimiters,
quotes,
an ampersand,
a backslash,
and newlines;
its expected escaped text is authored separately from the native formatter.
Original source/run/publication rejection controls passed `proc_848f`.

Construction and byte appearance alone are insufficient:
source membership and actual native visibility remain independent requirements.
The installed formatter required no changes;
this is private source accounting rather than an upstream defect or filing.

### Prompt and tool guideline insertion needs the original render window

SDK 1.1.0 `dist/core/system-prompt.js:57` visits tool guideline arrays before prompt guideline entries.
The same native `addRule` normalization and deduplication determines which original occurrence contributes.
An equal later entry must not borrow the first entry's insertion.

```javascript
// Installed pi-coding-agent dist/core/system-prompt.js:57
for (const name of selectedTools) {
    for (const rule of toolGuidelines[name] ?? [])
        addRule(rule);
}
for (const rule of promptGuidelines)
    addRule(rule);
```

The private adapter now constructs the existing guideline source records as private drafts
from the original frozen render input.
The fixed native loops report their field,
tool name where applicable,
loop-local ordinal,
raw value,
and observed local insertion result directly to that owner.
The owner seals and publishes the same records rather than creating a second inventory.
The recorder never supplies an instruction tier or a decision.

The existing run owner's render-finally path closes the observation window on success and failure.
Late or foreign-render calls reject before recording a new failure on an old run.
Failures during an accepted observation enter the original failure ledger,
so catching one in the builder cannot revive eligibility.
Legacy owner fixtures without native rendering retain their inputs without an insertion fact.

Required red `proc_99ae` preceded actual-serializer green `proc_f2dc`.
Original-record,
lifetime,
and unchanged-builder-output controls passed `proc_8829` and `proc_ab19`.
The latter includes a caught liveness failure that throws `false`.
Expanded visibility matrix `proc_b1b1` passed 69 modes;
consumer-owner controls passed `proc_c84f`.
The matrix includes duplicate entries within one array,
equal prompt/tool entries,
whitespace-equivalent entries,
hidden/inactive tool guidelines,
empty inputs,
custom prompts,
section overrides,
and forced output.

Failure-recording omission `77e34e4` failed `proc_acd7` with `Missing expected exception.`:
a builder caught the observation failure and incorrectly completed its render.
Render-window omission `a143431` failed `proc_3d7a` by recording
`Guideline insertion observation is already sealed` on the old scope after a late call.
Producer omission `6cfcc6c` failed `proc_95dc` with `1 !== 0` for a suppressed contribution.
Consumer omission `d3ab546` failed `proc_5308` with `accounted` instead of `unresolved`
for `Guideline not-inserted`.
Every guard is restored.
Full native `proc_f733`,
action `proc_8b6b`,
and eleven-document render `proc_1cf2` passed.
Native guideline handling itself was correct;
this remains a private source-consumption and ownership change,
not an upstream filing.

### SDK 1.1.0 handler messages need original construction and conversion links

The private required control failed `proc_51d1` with Node's `AssertionError [ERR_ASSERTION]`:
`The original retained handler message needs its own non-system field association`.
The native body contained the handler text;
the private source consumer had no lineage across the native object constructions.

SDK 1.1.0 `dist/core/agent-session.js:1615` creates a new native custom message
from each original emitter-result member:

```js
// Pi SDK 1.1.0, dist/core/agent-session.js:1615 to 1625
for (const msg of result.messages) {
    messages.push({
        role: "custom",
        customType: msg.customType,
        // Untyped extensions can pass null/missing content; normalize at ingestion.
        content: msg.content ?? [],
        display: msg.display,
        details: msg.details,
        timestamp: Date.now(),
    });
}
```

SDK `dist/core/messages.js:89` creates another object during LLM conversion:

```js
// Pi SDK 1.1.0, dist/core/messages.js:89 to 97
case "custom": {
    const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    return {
        role: "user",
        content,
        timestamp: m.timestamp,
    };
}
```

Pi AI 1.1.0 `dist/api/openai-completions.js:933` filters empty text
and constructs fresh provider text blocks.
Its text branch is:

```js
// Pi AI 1.1.0, dist/api/openai-completions.js:936 to 941
if (item.type === "text") {
    return {
        type: "text",
        text: sanitizeSurrogates(item.text),
    };
}
```

The private patch observes those actual constructions,
the existing native manager copy sites,
and the existing projection's `sourceEntry`/message relationships.
It does not match origins by text,
entry ID,
message ordinal,
or `customType`.
Context-edit targets do not republish the displaced source,
including when replacement text is equal.
Other custom-message append sites serve boundary drafts and `sendCustomMessage` deliveries;
they have no retained original handler-input publication merely because their text matches.

The verified consumer preserves original string or JSON source text,
owns fresh nested payload containers,
and seals through the existing terminal JSON validation.
There is no extra request parse or request re-encoding.
The installed/private conversion check passed `proc_1bd1`:
15 SDK cases and 60 provider cases,
including image downgrading and synthetic transcript messages.
Canonical handler accounting passed `proc_e424`;
original-source/run consumer controls passed `proc_9621`;
the restored 24-mode native matrix passed `proc_7137`.
Run `mise --no-env --no-hooks run test:handler-source-controls`
inside private `contract/integration/native-batch`.

The passing catalog includes original structured text,
empty/nullish inputs without invented transmission,
equal independent inputs,
blocked-image settings with text,
native context edits,
and mutation of discarded payload aliases before and after materialization.
Unsupported image input still rejects at the incumbent text-only snapshot boundary.
Malformed Unicode remains retained but unassociated under this original-text profile.

Two private guard defects were reproduced and fixed.
`proc_2adc` reported `Equal independent nested replacement must retire content-array`:
equal text had concealed replacement of an original nested object.
Alias signatures now compare the original content and part references,
not only values and descriptor flags.
`proc_9061` reported
`Observed accessor substitution cannot revive after descriptor restoration`
with `true !== false`.
Known handler currentness now runs before structural rejection can skip retirement.

The first matrix attempt `proc_2a7c` also caught a fixture error:
its callback changed both requests while its getter assertion expected only the first.
The fixture now explicitly targets the first request.
The first restoration attempt `proc_71c1` threw its assertion inside the native stream catch;
the explicit `proc_9061` control records the observation and asserts outside that catch.
These failures are not upstream SDK defects,
and no installed source was changed.

The expanded 26-mode matrix passed `proc_2471`,
including real later-review ancestry and new-prompt isolation from persisted equal text.
Deliberate omissions failed for nested part identity (`proc_cecc`),
context-edit exclusion (`proc_dd37`),
nested payload custody (`proc_6256`),
and original emitting-run membership (`proc_6486`).
Every guard is restored.
Full native `proc_41bf` and action `proc_de99` passed;
eleven-document rendering passed `proc_c7e4` before this evidence update.

### Original root scheduling must be captured at the deciding dispatcher

The private scheduling control `proc_c205` reached canonical review but found
`groupExecutionMode` absent from original prepared members.
Node reported `AssertionError [ERR_ASSERTION]`:
`Original prepared members must retain the deciding dispatcher group mode, not later configuration`.

The incumbent private dispatcher in
`contract/diagnostic/parallel-tool-batch/prepared-dispatch.mjs:40`
computes the effective group mode once:

```js
// Private contract/diagnostic/parallel-tool-batch/prepared-dispatch.mjs:38 to 40
const scheduled=Object.freeze(calls.map(call=>Object.freeze(structuredClone(call))));
if(executionMode!=='parallel' && executionMode!=='sequential')throw new PreparedBatchContractError('Unknown batch execution mode');
const serial=executionMode==='sequential' || scheduled.some(call=>tools.find(tool=>tool.name===call.name)?.executionMode==='sequential');
```

The same `serial` value controls entry-turn waiting.
The maintained private `contract/integration/native-batch/program-source.mjs` now extends
the existing dispatcher copy's member-publication expression with that value:

```js
// Private native dispatcher publication generated by program-source.mjs
groupExecutionMode: serial ? "sequential" : "parallel"
```

It creates a new frozen member shape at the existing publication,
rather than mutating a frozen record or recomputing from later configuration.
The original judgment already serializes the prepared manifest;
the semantic wire forwards that serialization unchanged.
The generator reuses the original dispatcher error classes.
Installed files and historical generated dispatcher artifacts are untouched.

The first latching fixture mistakenly changed authenticated live `agent.toolExecution`
and expected policy review to continue.
`proc_1a87` exposed the existing `ExecutionContextOwnershipError` from
private `contract/integration/native-batch/tools.mjs:69`:
`Native tool "codemode" or its context owner changed after request preparation`.
That guard is correct and remains unchanged.
The corrected controls distinguish a discarded batch-argument alias from the live configuration:
the alias cannot rewrite the already captured mode,
while a live change retires the original context before semantic assessment.

The scheduling/configuration controls passed `proc_5337`;
actual current-dispatcher execution,
queue,
abort,
and disposal passed `proc_c317`.
The complete-group consumer control then failed `proc_e3d5`
because admitted whole-operation estimates were still restricted to one original member.
Parallel and sequential group consumption passed `proc_5a03`,
and the 12-mode native matrix passed `proc_bce2`.
Unknown,
unsupported,
abstained,
and independently fact-owned operation uses retain their unresolved obligations.
Run `mise --no-env --no-hooks run test:group-scheduling`
inside private `contract/integration/native-batch`.

These are private consumer and fixture changes,
not an upstream defect or a reason to relax configuration freshness.
No model was asked to decide scheduling or the final action outcome.

### SDK 1.1.0 expanded prompt identity differs from transport user role

The original body already retained prompt bytes,
but the private source set had no original expanded-prompt occurrence.
Required control `proc_2f9f` failed with Node's `AssertionError [ERR_ASSERTION]`:
`The native expanded prompt needs its original run-bound source capability, not attribution from serialized user role`.
After adding capture to the existing run owner,
`proc_6dd4` reached the missing serialized-contribution assertion.
This separates absent input ownership from absent publication lineage.

SDK `dist/core/agent-session.js:1591` passes the post-input/skill/template text
into its actual before-agent-start emitter:

```js
// Pi SDK 1.1.0, dist/core/agent-session.js:1591
const result = await this._extensionRunner.emitBeforeAgentStart(expandedText, currentImages, this._baseSystemPromptOptions);
```

The native image normalizer can then change the text
at `dist/core/agent-session.js:1600`:

```js
// Pi SDK 1.1.0, dist/core/agent-session.js:1600
const userText = normalized.hints.length > 0 ? `${expandedText}\n\n${normalized.hints.join("\n")}` : expandedText;
```

The private capture identifies `expandedText`,
not an unmodified human utterance or every upstream transformation.
Its text-only publication observes the actual native user-message construction.
Image-containing and hint-modified constructions keep their original input source
without receiving an unsupported contribution association.
Native output and errors remain native.

The original copy/publication index is reused for ordinary user identity pass-through,
manager/context copies,
and the fixed native serializer.
The collector's combined field is `runMessageInputs`
(renamed from snapshot `handlerMessageInputs` on 2026-10-09);
per-run `handlerMessageInputs` remains emitter-only.
The original expanded input is unregistered.
No second JSON parse,
request re-encoding,
parallel message inventory,
or role-derived authority was introduced.

Initial full consumer `proc_3e36` passed.
Owner regressions passed `proc_1190`,
conversion parity `proc_f69b`,
source-policy `proc_898f`,
and action `proc_dd50`.
The 23-mode native matrix passed `proc_7109`,
including actual native image and normalization-hint routes.
The passing catalog distinguishes independent deep material copies from wrappers
that retain original part capabilities,
and covers context edits,
input transformation,
empty/whitespace/malformed text,
payload races,
active ancestry,
and separate new prompts.

The additional retirement control passed `proc_eebb`.
Removing pass-through currentness observation failed `proc_334e`:
an equal replaced part regained an `accounted` contribution on a later request after restoration.
Run `mise --no-env --no-hooks run test:expanded-prompt-controls`
inside private `contract/integration/native-batch`.
Scalar-publication omission `proc_b17c` also admitted a copied publication;
hint-profile omission `proc_7ea3` changed unsupported hint handling into an exception.
All guards are restored.
Full native `proc_5d3b`,
full action `proc_15a2`,
and 12-document rendering `proc_2db5` passed.
This proves a bounded origin edge,
not complete request-domain coverage,
source authority,
or permission.

### SDK 1.1.0 failed migration writes leave a partial in-place load

A disposable read-only version-2 session caused native `setSessionFile`
to throw filesystem `EACCES` from `open` during migration rewriting.
The installed and private managers returned equal surviving projections,
but those projections still selected the previous indexed entries.
Their entry arrays already contained the attempted new load.

The deciding order is in SDK `dist/core/session-manager.js:717`:

```js
// Pi SDK 1.1.0, dist/core/session-manager.js:717
_loadEntries(entries, options) {
    const header = entries.find((e) => e.type === "session");
    if (header) {
        this.fileEntries = entries;
        this.sessionId = header.id;
        if (migrateToCurrentVersion(this.fileEntries)) {
            this._rewriteFile();
        }
    }
    else {
        this.newSession(options);
        this.fileEntries = this.fileEntries.concat(entries);
    }
    this._buildIndex();
}
```

The rewrite can fail after replacing `fileEntries` but before rebuilding `byId`.
This does not establish a rollback guarantee.
The original fixture `proc_12a4` wrongly expected the attempted new value
to be the value returned by the surviving projection.
Corrected `proc_84c8` checks both the new entry-array value and the old projected value,
native output/error parity,
and unchanged read-only file bytes.

The private origin reader withholds the prior indexed value's origin
rather than relabeling it as the attempted new load.
This remains an unresolved provenance case,
not a qualified session continuation.
A separate invalid-file switch that fails before entry replacement preserves the original loaded values
and their existing original load occurrence.
Native root retirement remains independent.

The checks use only disposable files and restore their writable modes afterward.
No native rollback,
file repair,
or upstream SDK modification was implemented.
The successful loading and migration controls are distinct:
`proc_3dd2` covers original manager identity and value output;
`proc_68f4` covers version-1/version-2 migration and invalid-file opening;
`proc_84c8` covers failed in-place loading.

Provenance capture failures also have a separate boundary.
Unsupported loaded content or an exceeded source bound leaves native file loading intact,
but stops the private source-use path before transport.
That is intentional fail-closed behavior,
not transparent compatibility with every unguarded prompt.

### SDK 1.1.0 compaction projection has distinct system and summary outputs

A private summary observer must not assign one summary input's identity to every message from its entry.
Native `appendCompaction` stores the current system message inside the new compaction entry.
SDK `dist/core/session-manager.js:880` contains:

```js
// Pi SDK 1.1.0, dist/core/session-manager.js:880
const systemMessage = getCurrentSystemMessage(this.buildSessionProjection().messages);
// Entry construction includes this separate companion:
...(systemMessage ? { systemMessage: { ...systemMessage, timestamp: new Date(timestamp).getTime() } } : {}),
```

The same file's `sessionEntryToContextMessages`,
at line 188,
constructs the summary separately:

```js
// Pi SDK 1.1.0, dist/core/session-manager.js:188
const summary = createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp);
return entry.systemMessage ? [entry.systemMessage, summary] : [summary];
```

The original system entry is not duplicated in the retained range:
`buildContextEntries`,
at line 223,
excludes system-message entries there:

```js
// Pi SDK 1.1.0, dist/core/session-manager.js:223
if (foundFirstKept && !(entry.type === "message" && entry.message.role === "system")) {
    contextEntries.push(entry);
}
```

A reviewer hypothesis that one projected system message disproved a same-entry companion was incorrect.
Native row-cardinality assertions in `proc_047a` verify the actual two-output compaction row,
including its stored `systemMessage`.

The private `contract/integration/native-batch/root-source.mjs` generator observes the actual summary constructor.
The shared publication owner records only that summary output's input-only identity.
Its generic entry projection still requires one output,
so it cannot assign summary provenance to the system companion.
The summary-to-user conversion observer preserves historical input identity without payload eligibility.
No additional file parser,
request parser,
or transcript inventory was added.

Required missing-source control `proc_640e` failed;
connected compaction and branch-summary consumers passed `proc_1efc`.
Empty-summary and other loaded-input modes passed `proc_503b`.
Native output parity,
same-entry companion isolation,
version-1/version-2 migration,
failed migration-rewrite withholding,
shared limits,
and distinct equal-value occurrences passed `proc_047a`.
Compaction-constructor omission `proc_de3c` lost the summary alias;
the constructor observation is restored.
Companion-attribution omission `proc_9769` failed because the stored system message acquired summary provenance.
The single-output guard is restored.
Complete native `proc_18d1`,
action `proc_06a7`,
source-policy `proc_62b3`,
and 14-document rendering `proc_7bd6` passed.

Run the private controls from `contract/integration/native-batch`:

```sh
# Private consumer-contract repository, contract/integration/native-batch
mise --no-env --no-hooks run test:loaded-summary-manager
mise --no-env --no-hooks run test:loaded-input-controls
```

The boundary remains partial:
stored system companions and current-run generated summaries do not gain an original instruction-source capability
from capturing a loaded summary.
Saved summaries establish neither historical human intent nor governing authority.
This is private adapter propagation,
not an upstream defect;
the filing disposition in this section remains unchanged.

### SDK 1.1.0 stored system deltas differ from compaction checkpoints

A system source fixture incorrectly expected a checkpoint to preserve a null section deletion verbatim.
`proc_3666` instead reported a source containing only the surviving text section.
The original loaded delta still contained the null value.

Native `appendCompaction` stores the result of system-message replay,
not a byte copy of every prior message.
Pi AI `dist/utils/transcript.js:69` applies section updates:

```js
// Pi AI 1.1.0, dist/utils/transcript.js:69
for (const [name, value] of Object.entries(message.sections ?? {})) {
    if (value === null)
        sections.delete(name);
    else
        sections.set(name, value);
}
```

The private fixture now checks original system entries and stored checkpoint companions independently.
The source observer retains their original values rather than rewriting either to match the other.
It captures content and sections only,
without extracting tool definitions or rebuilding the request body.
Native section deletion does not establish revocation of a governing instruction.

Private owner and native companion checks passed `proc_950c`.
The corrected source matrix and complete regression remain tracked in the private progress record.
This is a fixture correction and private provenance extension,
not an SDK defect or an upstream filing.

### SDK 1.1.0 bash record formatting creates a new user message

A loaded `bashExecution` record is data about a command,
not authenticated proof that the command ran.
Its native formatting also creates a different object.
In `dist/core/messages.js:79`:

```js
// Pi SDK 1.1.0, dist/core/messages.js:79
case "bashExecution":
    if (m.excludeFromContext) {
        return undefined;
    }
    return {
        role: "user",
        content: [{ type: "text", text: bashExecutionToText(m) }],
        timestamp: m.timestamp,
    };
```

The private observer follows that actual construction edge.
It preserves input-only identity without authenticating payload text or historical execution facts.
Excluded and compacted inputs remain separately retained through original source membership.

Required missing-input red `proc_f853` became native consumer green `proc_5aac`.
Native formatting and exclusion variants,
owner getter/profile controls,
and the 31-mode loaded-input matrix passed `proc_589c`.
Conversion omission `proc_30e1` lost the resulting user message's original publication.
The conversion observation is restored.
Complete native `proc_aa93`,
action `proc_25cc`,
source-policy `proc_7e06`,
and 14-document rendering `proc_e36e` / `proc_0f9f` passed.

Run `mise --no-env --no-hooks run test:loaded-bash-manager`
inside private `contract/integration/native-batch`.
The fixtures write authored session records,
but do not execute their recorded commands.
This is a private propagation repair,
not an upstream defect or a filing proposal.

### SDK 1.1.0 context edits create replacement messages without transferring authority

Native context edits retain message metadata while replacing content.
In `dist/core/session-manager.js:235`,
`projectContextEntry` returns no messages for a null replacement.
For supported editable roles,
line 252 constructs a fresh output:

```js
// Pi SDK 1.1.0, dist/core/session-manager.js:249
const content = (message.role === "assistant" || message.role === "toolResult") && typeof replacement.content === "string"
    ? [{ type: "text", text: replacement.content }]
    : replacement.content;
return { ...message, content };
```

The private observer attaches the original edit input only at that construction.
It does not reuse the displaced target's publication.
System messages and summaries that the native non-null edit leaves unchanged do not acquire edit provenance.
Missing targets likewise produce no replacement output.

The canonical equal-edit fixture initially searched only array-shaped user content.
Pi AI `dist/api/openai-completions.js:926` preserves scalar user text:

```js
// Pi AI 1.1.0, dist/api/openai-completions.js:926
if (typeof msg.content === "string") {
    params.push({
        role: "user",
        content: sanitizeSurrogates(msg.content),
    });
}
```

`proc_5125` and the matrix phase of `proc_2061` exposed that fixture omission.
The fixture now checks both native representations.
A separate fixture error,
`proc_871e`,
used a family-unspecific hidden-mode match and unintentionally created a compaction for `edit-hidden`.
That flag now requires the compaction-system family.
Neither correction changes runtime provenance or native output.

Corrected `proc_da68` passed native editable-role variants,
unapplied system/missing/compaction targets,
owner shape/getter/shared-cap checks,
and the 36-mode loaded-input matrix.
Construction omission `ddc6f13` / `proc_e0e8` lost the edited message's original publication.
The observer is restored.
Complete native `proc_36c9`,
action `proc_fafc`,
source-policy `proc_80b6`,
and 14-document rendering `proc_18b1` passed.

Run `mise --no-env --no-hooks run test:loaded-edit-manager`
inside private `contract/integration/native-batch`.
Omissions and shadowed edits remain original inputs,
not proof that an earlier governing instruction was revoked.
The source profile remains input-only and unregistered.
This is private consumer propagation and fixture repair;
no upstream defect or filing is proposed.

### Rejected approaches and filing disposition

Byte equality and transport role cannot replace source custody.
A check of mutable payload aliases after serialization is also the wrong lifetime:
the immutable historical request has already been produced.
Neither approach is used as source authentication.

No upstream filing is warranted:
the lost association arose from private adapter copies and missing private propagation.
Upstream capability propagation has not been established as a supported API requirement.
Fixability does not imply an upstream defect,
contribution welcome and maintainer intent were not evaluated,
and no upstream patch is proposed.
The verified patch belongs to the private consumer.
There is no upstream filing artifact to add.

## Private SDK 1.0.4 adapter misses runner and schema mutation

### Symptoms

These failures belonged to the private integration,
not the installed SDK.
Paths in this section are relative to the private consumer-contract repository,
unless an installed package is named.

`proc_305f` and `proc_6072` reproduced public runner shadowing and prototype-method replacement.
The inert program returned a guarded root error instead of completing.
The test emitted `AssertionError [ERR_ASSERTION]: true !== false`.
After private runner storage alone passed,
prototype replacement still redirected the method lookup.

`proc_c467` reproduced a different failure.
Changing an input schema in place after fixture assessment still permitted its three inert child executions.
The test emitted `AssertionError [ERR_ASSERTION]: false !== true`.
This was independently authored fixture execution,
not a demonstrated production policy release.

### Cause and repair

The private adapter had protected object references without fixing every consumed method or nested data dependency.
Current `contract/integration/native-batch/program-source.mjs:10,17`
captures the original method before later prototype mutation
and invokes it through the private session runner:

```javascript
// contract/integration/native-batch/program-source.mjs, generated source excerpts
const originalCreateDeclaredProgram=NestedToolCallRunner.prototype.createDeclaredProgram;
Reflect.apply(originalCreateDeclaredProgram,session.#getOwnedProgramRunner(),[input])
```

Schema reference identity was insufficient.
Installed `@earendil-works/pi-ai@1.0.4/dist/utils/validation.js:280`
uses the schema during argument preparation:

```javascript
// Installed pi-ai dist/utils/validation.js
normalizeOptionalNulls(args, tool.parameters);
Value.Convert(tool.parameters, args);
const validator = getValidator(tool.parameters);
```

The existing execution-tool owner now retains data descriptors
and validates both schema graphs at its currentness boundary.
Relevant code is `contract/integration/native-batch/tools.mjs:29,45,61,62,68`:

```javascript
// contract/integration/native-batch/tools.mjs, currentness excerpt
assertParameters();assertOutputSchema();
```

The comparisons include symbol keys,
descriptor attributes,
prototypes,
and original values.
They do not freeze borrowed objects or extract and encode a second request representation.
Callable values remain identity dependencies,
not proof of implementation semantics.
Ordinary schema records and arrays are supported;
accessors and nonordinary object prototypes are rejected.
The request-wide bound is 10,000 property and object entries.
This boundary is not a guarantee about arbitrary host callbacks or complete operation effects.

### Verification and tradeoffs

Private fix `87b8e7e` passed public-shadow control `proc_5adc`.
Fix `3100219` passed prototype and input/output schema controls in `proc_9d00`.
Expanded native matrix `proc_5caf` passed 18 cases,
including original failure-cause and terminal-state assertions.
Unit control `proc_a52b` passed nested,
array,
symbol,
hidden-property,
accessor,
prototype,
descriptor,
callable-reference,
bound,
and permanent-retirement cases.
These unit controls use execution-position facades;
they are not native authentication or policy-admission evidence.
Full native suite `proc_c1b1`,
action compatibility `proc_edaa`,
and source compatibility `proc_bdbb` passed.

From `contract/integration/native-batch`,
the runnable controls are:

```sh
# Private consumer-contract repository, contract/integration/native-batch
mise --no-env --no-hooks run test:program
mise --no-env --no-hooks run test:tools
```

The earlier `proc_3948` failure was a test mistake:
inspection includes declared `unreached` groups.
Counting only reached states repaired that assertion without changing an execution guard.
A successful inert fixture does not qualify semantic estimates,
authority interpretation,
or production permission.

### Native loadout description preservation

A later control,
`proc_3145`,
found that wrapping the registered definition discarded the native projected description.
It specifically lost
`Codemode: tools.fixture_value(args) resolves to a string.`
(the native text places the call expression in backticks).
The fixture rejected the group with
`Preserve native loadout descriptions for fixture_value`.

Installed `@earendil-works/pi-coding-agent@1.0.4/dist/core/agent-session.js:1190`
creates that description projection without replacing the registered executable definition:

```javascript
// Installed pi-coding-agent dist/core/agent-session.js
declared = tools.map((tool) => {
    const description = descriptions.get(tool.name);
    return description === undefined ? tool : { ...tool, description };
});
```

Current `contract/integration/native-batch/tools.mjs:84`
preserves the projected description with the existing owned callbacks:

```javascript
// contract/integration/native-batch/tools.mjs
const wrapped=wrapTool(tool.name),projected=Object.freeze({...wrapped,description:tool.description});
```

`proc_8ebd` passed the real native description and callable-snapshot controls.
This repairs a consumer-side loss of native metadata;
it does not make descriptions permission or qualified effect evidence.

### Rejected approaches and upstream filing decision

Private storage alone did not protect prototype method lookup.
Schema-reference comparison alone did not detect in-place mutation.
Adding another JSON tools source would not solve either consumed-runtime dependency.

- Upstream fault:
   no.
  The reproduced omissions were in our private adapter.
- Upstream fixability:
   not needed for these fixes.
  They are implemented at the existing consumer boundary.
- Supported upstream use case:
   the private ownership contract is not asserted to be an SDK guarantee.
- Contribution policy:
   not investigated because no upstream defect or filing is proposed.
- Maintainer intent:
   not investigated for the same reason.
- Prototype:
   private fixes and controls exist;
  no upstream patch is claimed.

There is nothing to file upstream from this evidence.
No SDK issue,
provider request,
or installed-source modification occurred.

## Typed-relation verification: Git inspection timeout and overlapping index access

### Observations

On 2026-10-08,
the Bash tool timed out a private-repository `git status --short` and `git log` inspection after 20 seconds.
It reported the existing logger diagnostic:

```text
# Reported during the owned Git inspection; emitting process was not captured.
logger internal error: sink verification failed for entry 3: Timed out after 5000ms: sink 3 verify
```

This was not a policy test or a state-changing Git invocation.
It does not establish the cause described in another logger incident.
The existing [logger investigation](cli-git-logger-sink-verify-timeout.md) retains the unresolved cause limits.

The recovery inspection `proc_0b64` completed.
The assistant incorrectly overlapped it with sensitivity commit `proc_e866` in the same private repository.
That commit command failed at `git add` with `index.lock: File exists`;
its test did not run.
The actual lock holder was not captured,
so overlapping dispatch is an observed scheduling error,
not proof of a particular Git implementation path.

### Recovery and verification

After both processes exited,
`ls --full-time .git/index.lock` reported no lock,
and the scoped process search found no matching Git process.
No lock was removed.
The inspection showed the intended source modification still uncommitted and no new omission commit.
Serialized `proc_a4ae` then committed omission `1c41a06` and reached the expected immutability assertion failure.
Restoration `88f3635` passed separately as `proc_c971`.
All Git calls for this repository are now serialized,
including inspection calls.
A successful later invocation is not evidence that the logger delay was fixed.

### Rejected actions and upstream scope

Do not classify a rejected Git command as a failed test,
blindly replay an ambiguous commit,
or remove an unassigned index lock.
No upstream SDK or Git defect was established,
and no issue was filed or reopened.

## SDK 1.0.4 default prompt with an independent policy copy exceeds the private source cap

### Symptom and cause

The expanded native control `proc_83e5` retained this synthetic terminal diagnostic:

```text
# contract/collector/collector.mjs
Current rendered prompt exceeds source byte cap
```

The emitting `SourceCollectionError` belongs to our private collector,
not the SDK or provider.
Paths in this section are relative to the private consumer-contract repository.
`contract/collector/collector.mjs:10,16,73` checks the complete rendered string:

```javascript
// contract/collector/collector.mjs
const limits = Object.freeze({ sourceBytes: 65_536, totalBytes: 524_288, files: 64, appendTexts: 32 });
if (Buffer.byteLength(value) > limits.sourceBytes)
  throw new SourceCollectionError(`${label} exceeds source byte cap`);
const rendered = text(adapter.render(), 'Current rendered prompt');
```

This cap is distinct from the one-MiB base-linked snapshot bound described in
`Owned SDK 1.0.4 hook masked terminal errors`.
It also differs from the generated-fragment text cap.
The measured default preamble was 169 bytes;
documentation guidance was 1517 bytes in the empty-system fixture.
Those fragments did not individually exceed their source bound.

### Verification and supported boundary

`proc_a631` ran `mise --no-env --no-hooks run test:full-policy:default`
in `contract/integration/native-batch/`.
The native terminal listener measured the actual current rendered prompt before run settlement.

- Linked current policy:
   34,332 rendered bytes,
  207 canonical clauses,
  414 questions,
  one local relation response.
- Additional independent equal-text policy copy:
   66,405 rendered bytes,
  source-cap rejection before judgment creation,
  zero relation requests.

Both cases used the unmodified current policy as disposable fixture text.
No provider request occurred.
The default prompt with the linked policy is supported by this control;
the failure must not be generalized to that case.

### Limits and rejected remedies

No bound was raised and no policy text was trimmed.
An independent copy cannot be merged merely because its bytes match.
The negative control now asserts the actual earlier source-cap boundary,
rather than demanding the later clause-batch rejection.
The accepted original-source carrier remains the supported representation for genuine linked copies,
but it is not a workaround that authenticates an independent source.
The oversized independent default case remains unsupported.

### Upstream filing decision

No upstream defect or filing artifact is established:

- Fault:
   the bound belongs to our private collector;
  the test expected to reach a later boundary.
- Feasibility:
   an explicit negative control preserves the existing profile;
  no SDK change is requested.
- Support:
   the default SDK rendering and linked-source path were exercised successfully.
- Contribution policy:
   not investigated because no upstream contribution is proposed.
- Maintainer willingness:
   not investigated because no upstream change is requested.
- Prototype:
   the consumer-side control passed;
  installed SDK sources remain unchanged.

## SDK 1.0.4 empty append configuration is not an empty published entry

### Owned fixture symptom and cause

The private `run-input-carriers.test.mjs` fixture in `proc_90fe` configured
`appendSystemPrompt: ['', 'Retained appendix', '']`
and incorrectly expected the resource loader to publish all those positions.
Node's `assert.strictEqual` raised `AssertionError [ERR_ASSERTION]` with `1 !== 3`.
The native agent retained that assertion text in its synthetic terminal error;
the fixture then failed its expected assistant text check.

Installed SDK 1.0.4
`package/pi-plugin/auto-mode/node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js:100-103`
treats a falsy configured prompt input as absent:

```javascript
// package/pi-plugin/auto-mode/node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js
function resolvePromptInput(input, description) {
    if (!input) {
        return undefined;
    }
```

The same file at lines 481 to 486 resolves and filters configured inputs before invoking the append override:

```javascript
// package/pi-plugin/auto-mode/node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js
const baseAppend = appendSources
    .map((s) => resolvePromptInput(s, "append system prompt"))
    .filter((s) => s !== undefined);
this.appendSystemPrompt = this.appendSystemPromptOverride
    ? this.appendSystemPromptOverride(baseAppend)
    : baseAppend;
```

The source-custody implementation had retained the actual native output correctly.
The configuration-to-output count assumption belonged to the fixture.

### Verification and corrected fixture

`proc_26ba` passed `mise --no-env --no-hooks run test:run-inputs`
in the private `contract/integration/native-batch/` directory.
The corrected fixture asserts the resolved input first,
then constructs the empty output positions at the intended native boundary:

```javascript
// contract/integration/native-batch/run-input-carriers.test.mjs
appendSystemPromptOverride(previous) {
  assert.deepEqual(previous, ['Retained appendix']);
  return ['', 'Retained appendix', ''];
}
```

The installed type declaration exposes that callback in
`package/pi-plugin/auto-mode/node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.d.ts:123`.
Both present-system and absent-system session variants passed.
They retain the complete ordered append sequence,
including empty outputs,
without selecting a subset by text matching.
Other passing cases cover equal clones,
empty or removed custom text,
changed append text,
added/reversed/removed/empty context entries,
late aliases,
and original snapshot ownership.
No provider requests occurred.

The callback deliberately constructs replacement outputs.
This tests their publication and downstream custody;
it does not claim that empty configuration strings survive native resolution.
Do not weaken the carrier assertion or change SDK resolution to repair this fixture.

### Upstream filing decision

There is no upstream defect or filing artifact:

- Fault:
   the fixture confused configured inputs with published outputs.
- Feasibility:
   the fixture boundary correction is implemented;
  no SDK change is requested.
- Support:
   the installed callback type accepts an output string array,
  and the actual native invocation passed.
- Contribution policy:
   not investigated because no upstream contribution is proposed.
- Maintainer willingness:
   not investigated because no upstream behavior change is requested.
- Prototype:
   the consumer-side correction passed the native session matrix;
  installed SDK sources remain unchanged.

## Owned SDK 1.0.4 hook masked terminal errors

### Symptom and cause

The private judgment-start listener failed in `proc_edda` with:

```text
# contract/integration/action-policy/judgment-start.mjs
RequestProducerError: Response has no producer observation for this exact consumer
```

The listener authenticated every assistant message before checking whether the native loop could execute it.
Pi's installed `pi-agent-core/dist/agent.js:365-383` constructs an error response in `handleRunFailure`.
That message reports a host-side failure;
it is not a model response associated by our request producer.
Our callback therefore replaced the native diagnostic with an ownership error.

The corrected private `contract/integration/action-policy/judgment-start.mjs:11-14` checks non-executing
terminal reasons before producer authentication:

```javascript
// contract/integration/action-policy/judgment-start.mjs
if (response.stopReason === 'error' || response.stopReason === 'aborted') return;
producerOwner.assertMainAgentResponse({response, stream});
```

Executable responses still require the original producer observation.
No new judgment or budget is created for the native terminal error.

### Verification and distinct size boundary

`proc_f814` passed `mise --no-env --no-hooks run test:start-failure` in the private
`contract/integration/native-batch/` directory.
A real SDK session retained its original local-stream error,
started no judgment,
and made no provider request.
`proc_a46f` passed the action controls,
including rejection of an unowned executable response.

The full-policy diagnostic `proc_052e` then exposed a separate limit:

```text
# contract/collector/rule-relevance-sdk-copy/stage-private/resource-owner.mjs:197
Base-linked source collection exceeds total byte bound
```

That private collector checks:

```javascript
// contract/collector/rule-relevance-sdk-copy/stage-private/resource-owner.mjs
if (Buffer.byteLength(JSON.stringify(snapshot)) > 1048576)
  throw new SourceCollectionError('Base-linked source collection exceeds total byte bound');
```

The oversized case included an independent copy of the full policy and a later run-ancestry snapshot.
The bound was not raised.
The negative mixed-batch fixture now ends explicitly after its batch-limit check;
it does not claim support for the later oversized snapshot.
The linked-source case completed its normal follow-up and passed in `proc_9e95`,
as did the complete native suite in `proc_690f`.

### Rejected remedies and filing decision

Do not authenticate a native terminal diagnostic as a model response.
Do not weaken authentication for executable tool proposals.
Do not discard independent equal-text sources or lift collection limits merely to make this fixture pass.

No upstream filing is warranted:

- Fault:
   our listener applied the wrong precondition;
  the collection limit belongs to our private consumer.
- Feasibility:
   the listener ordering correction is implemented and verified.
- Support:
   no SDK promise of producer identity for synthesized terminal diagnostics was relied on legitimately.
- Contribution policy:
   not investigated because no upstream change is proposed.
- Maintainer willingness:
   not investigated because no upstream fix is requested.
- Prototype:
   the local correction passed;
  there is no upstream defect or filing artifact.

## SDK 1.0.4 run publication resets at settlement

### Owned fixture failure

The private native prompt-custody test in `proc_8791` asserted that a request's run publication remained current
after `session.prompt()` returned.
The original collector rejected it with:

```text
# contract/integration/native-batch/prompt-custody.test.mjs
SourceCollectionError: Native run prompt was replaced after this source snapshot
```

The follow-up diagnostic `proc_0d2a` accessed `ordinal` on the now-absent publication and failed with
`TypeError: Cannot read properties of undefined (reading 'ordinal')`.
Neither failure demonstrates a native SDK defect.

### Deciding source and correction

Installed SDK 1.0.4 `dist/core/agent-session.js:1401-1408`,
inside `_runAgentPrompt`,
clears the run-specific prompt in its settlement cleanup:

```javascript
// Installed Pi SDK 1.0.4: dist/core/agent-session.js
finally {
    if (this._agentRunAbortRequested)
        this._finishCancelledRetry();
    this._failedResponse = undefined;
    this._runSystemPromptOptions = undefined;
    this._flushPendingBashMessages();
    this._flushPendingCustomMessages();
    await this._emitAgentSettled();
}
```

The private custody transform mirrors that reset through the incumbent run owner.
Request-time freshness and handler-alias independence must therefore be checked while the original run is active.
After settlement,
retain the historical snapshot but expect its freshness check to reject.
The current native reader reports an absent run,
not a replacement instruction authority or permission.

The fixture now checks active-run freshness inside its local stream,
then checks reset and stale-snapshot rejection after settlement.
`proc_a6fe` passed `mise --no-env --no-hooks run test` in the private `contract/integration/native-batch/` directory.
Active-run freshness and late-alias independence passed;
post-settlement,
copied-snapshot,
reload,
and disposal rejection passed.
The native handler and all source owners remain real;
only the model stream is local test data.

### Rejected reading and upstream decision

An absent run after settlement is not evidence that the native capture failed.
Keeping a completed run artificially current would contradict the SDK's reset boundary.
No upstream change is proposed:

- Fault:
   the fixture asserted freshness after native reset.
- Feasibility:
   correct the consumer's assertion phase.
- Support:
   no SDK promise of post-settlement run-publication currency was found.
- Contribution policy:
   not investigated because no upstream fix is requested.
- Maintainer willingness:
   not investigated because no upstream fix is requested.
- Prototype:
   the local correction passed;
  there is no upstream defect or filing artifact.

## SDK 1.0.4 private-copy license path assumption

### Symptom and cause

The owned current-SDK copy task failed in `proc_516a` at `copyFileSync`:

```text
# Private native-batch preparation
Error: ENOENT: no such file or directory, copyfile '.../pi-coding-agent/LICENSE' -> '.../.sdk-private/LICENSE'
```

The initial private `contract/integration/native-batch/prepare.mjs:50`
assumed the installed package shipped a file named `LICENSE`.
`ls --all` showed no such file in either installed 1.0.4 package directory.
This was an owned setup assumption,
not evidence of an SDK runtime defect.
The source copies had been written,
but the task had not completed and no SDK test had run.

### Verified recovery

The upstream [license](https://github.com/earendil-works/pi/blob/main/LICENSE)
matched the retained MIT notice.
The consumer now keeps that notice in `PI-LICENSE.txt`.
Current `contract/integration/native-batch/prepare.mjs:50` copies it explicitly:

```javascript
// contract/integration/native-batch/prepare.mjs
copyFileSync(join(import.meta.dirname, 'PI-LICENSE.txt'), join(output, 'LICENSE'));
```

`mise --no-env --no-hooks run test` in the private `contract/integration/native-batch/` directory
completed preparation and the native cases in `proc_3e64`.
The later termination and repeated-group cases passed in `proc_7fcb`.
The installed SDK files were not edited,
and no provider request was made.
The retained notice is independent of package layout;
future upstream licensing changes still require review rather than silently reusing it.

### Rejected approach and filing decision

Do not assume an npm package includes the repository-root license filename.
Do not remove the notice merely to make preparation succeed.

No upstream filing is warranted:

- Fault:
   the failing path was chosen by our consumer.
- Feasibility:
   the consumer correction is implemented and exercised.
- Support:
   no SDK promise of that installed filename was relied on legitimately.
- Contribution policy:
   not investigated because no upstream change is proposed.
- Maintainer willingness:
   not investigated because no upstream fix is requested.
- Prototype:
   the consumer fix is verified;
  there is no upstream defect prototype or public filing artifact to add.

## Owned prospective-input planner omitted rendered working-directory context

### Symptom and cause

The private prospective-input preparation,
`proc_6d51`,
stopped before publishing its manifest or launching an SDK worker:

```text
# Private prospective fixture preparation
AssertionError [ERR_ASSERTION]: assert(!body.includes(oldRoot))
```

The owned planner only rebased exact path values inside JSON.
Read-only `proc_cd8e` found that the complete captured main request also contained
the fixture directory inside a rendered system-message suffix:

```text
# Captured main-request message content
<cwd>
fixture-directory
</cwd>
```

The source was the private contract's
`contract/collector/program-rule-prospective-sdk/prospective.mjs`.
Its string branch left non-JSON text unchanged,
and its final old-root check correctly rejected that incomplete prediction.
This was a planner coverage defect,
not an established Pi or provider fault.

### Verified correction and guard witness

The fresh `program-rule-prospective-sdk-v2` sibling rebases only the inspected read-path fields
and the exact terminal working-directory suffix.
It preserves the policy prefix,
other messages,
and all question content.
Reverse rebasing must deep-equal the complete seed body.

`proc_4a49` verified that the predicted 256,710-byte body exactly matched
the body produced by a fresh native judgment:
one SDK session,
two local main requests,
one fake guard request,
205 original captured records,
and no tool execution.
This is a finite fixture profile,
not arbitrary text rewriting or source authority.

The mismatch control `proc_6418` added a final newline to the expected body only.
The original assessment recorded one attempt,
but the body gate stopped before any fake network fetch.
Both tool members remained `unentered`,
and the expected worker failure and persisted tool errors were retained.

The paired `proc_8812` removed only the exact authored body-equality guard.
Its fake fetch count became one;
the zero-fetch assertion failed with
`AssertionError`,
`ERR_ASSERTION`,
actual one and expected zero.
A later body verifier could detect the mismatch,
but cannot replace pre-dispatch enforcement.
Neither control contacted a provider or executed a tool.

### Rejected remedies and filing decision

Do not strip the working-directory context,
globally substitute arbitrary prompt text,
or reopen the failed preparation namespace.
All source,
stream,
persistence,
and cleanup checks remain separate from semantic qualification.

No upstream filing:
the fault was in the owned planner;
no upstream repair is established or proposed.
Native SDK support was exercised by the corrected fixture.
Contribution policy and maintainer disposition were not assessed because no upstream change is needed.
The demonstrated repair is consumer-side,
not an upstream patch.

## Full-rule binding loops and genuine dependency retirement

### Measured failure and bounded remedy

The first 205-rule native action fixture,
`proc_e496`,
failed during capture with `GoverningRuleBindingError: Governing-rule binding is no longer current`.
Its serializer omitted the cause,
so the original underlying failure remains unestablished.
Fresh instrumented attempt `proc_7e9b` recorded:

```text
# program-rule-sdk-diagnostic/controls-private/native-text/hook-failure.json
DependencyDeadlineError: Original dependency assessment deadline expired
lastCaptureIndex: 45
dependencyTraceCalls: 26485
remainingMs: -0.2679229999994277
```

The original signal was not aborted,
and the protected policy digest and mode still matched.
That observation identifies the diagnostic attempt's deadline failure,
not every possible source of the earlier wrapped error.

The old resolver repeated complete original dependency validation per binding:

```javascript
// Private program-rule-sdk-copy/stage-private/child-constructor.mjs:39
ready();const instruction=instructionBindings.get(bindingHandle);
```

Its rule reader also invoked the original source callback,
which performed another `ready()` check.
The private owner now batches immutable binding work between complete entry and exit checks.
It keeps the original signal and budget checks per rule,
and uses separate synchronous segments before and after the transport await.
No deadline extension or omitted rule is involved.

`proc_ca71` completed all 205 fake estimates and canonical captures,
recording 628 dependency-trace callbacks and no native tool execution.
`proc_b707` checked source changes at the exit boundary and across transport await,
clock expiry,
reentry,
and an exact omission of the postcheck.
The omission produced the authored `Missing expected exception.` witness.
These are finite Node 26.10.0/SDK 1.0.2 profiles,
not filesystem atomicity or a representative latency benchmark.

### Keep phase misuse separate from genuine source failure

The follow-up diagnostic `proc_e02b` exposed distinct paths:
a direct dependency check could fail without retiring captured batch evidence;
a late attempt to capture more evidence correctly rejected the closed phase
but incorrectly retired evidence already captured successfully.
Its closed-phase fixture then failed a stale expectation that the SDK would record no rejection.
That fixture error does not negate its completed in-hook checks.

The source check now retains its first genuine failure centrally:

```javascript
// Private program-rule-batch-sdk-copy-v2/stage-private/child-constructor.mjs:36
function dependencyCheck(read){
  try{return read();}
  catch(error){evidenceEligibilityFailure??=Object.freeze({cause:error});throw error;}
}
```

Caller phase checks remain outside this catch.
Canonical evidence authentication still precedes dependency validation.
`proc_8424` verified direct,
per-claim,
and batch retirement after source restoration,
stable first causes,
and harmless refusal of late collection calls.
No model score or retained record became permission.

### Cancellation diagnostics retain their layers

The postcheck-cancellation prefix in `proc_75d4` completed.
Its await suffix expected cancellation words in the top-level message,
but the original budget retains distinct failures:

```javascript
// Private contract/lifecycle/judgment-budget-error-occurrences/controls-private/candidate.mjs:34
throw new AggregateError([error,terminal],'Transport failure and judgment boundary failure');
```

The repaired expectation checked `ProgramRuleTransportError` and `JudgmentCancelledError` separately.
That suffix then hit another narrow fixture expectation:
the request observer wraps cancellation in its original-currentness error:

```javascript
// Private contract/lifecycle/root-lifecycle-retirement-entry/observer.mjs:35
if(scope.signal?.aborted)throw new RequestObservationStaleError('Observed request was cancelled',{cause:scope.signal.reason});
```

The surrounding catch emits `Observed request is no longer current` with that cause.
`proc_7d8a` verified the exact aggregate,
original native signal,
observer cause,
permanent retirement,
empty worker stderr,
persisted error outcomes,
and disposal on the corrected graph.
The completed postcheck prefix was not replayed.

### Rejected remedies and filing decision

Do not extend or restart the five-second budget,
drop indexed rules to make the fixture finish,
cache freshness across an await,
flatten distinct cancellation errors,
or treat caller phase misuse as a new source failure.
The batching remedy changes validation granularity within synchronous owned operations;
it does not qualify semantic answers or grant permission.

The observed defects and assertion mismatches belong to owned private integration code.
No Pi or Gateway defect was established.
Upstream fault,
fixability,
supported-use-case claims,
contribution acceptance,
and willingness therefore do not justify filing.
The local changes have the named native controls;
no upstream issue or comment is warranted.

## Original claim evidence must not regain eligibility after a dependency failure

### Symptom and distinct fixture failure

The private candidate-aware evidence handoff first failed in `proc_b5b2` with:

```text
# Private candidate-claim-evidence-sdk-consumer, after the next request generation
RequestObservationStaleError: Observed request is no longer current
```

Its cause was `Request generation changed`.
The fixture placed a retained-evidence assertion after `session.prompt()` had completed another main request.
This was correct original-request retirement,
not a restoration defect.
The intended changed/restored dependency suffix had not run.

Fresh active-request control `proc_f221` placed that suffix inside the original `beforeToolBatch` callback,
after evidence closure.
Changing disposable `b.txt` correctly rejected evidence validation.
Restoring its original bytes then incorrectly passed validation.
The authored assertion recorded:

```text
# Private candidate-evidence-restoration-sdk/controls-private/native-text/restoration-witness.json
AssertionError [ERR_ASSERTION]: Missing expected exception.
```

The SDK converted the thrown callback assertion into admission-blocked tool results.
A separate completion assertion ensured this error handback could not masquerade as a passing test.
No fixture tool executed in this failing restoration case.

### Root cause and verified repair

The original handoff authenticated the evidence object,
then performed only a current dependency check:

```javascript
// Private candidate-claim-evidence-sdk-copy/stage-private/child-constructor.mjs:107
function assertClaimEvidence(input){knownSelection().assertCapturedIdentity(input);assertDependenciesCurrent();}
```

Retained file comparison in `contract/lifecycle/external-dependency-controls/file-observer.mjs:91`
compares original path,
device,
inode,
mode,
and bytes.
It is a current comparison,
not a record that a caller's earlier eligibility assertion failed:

```javascript
// Private contract/lifecycle/native-text-read-contract/dependencies.mjs:83
function checkRetained(handle) { return revalidate({handle,verify:checkSignal}); }
```

The enclosing judgment now retains a failure sentinel for its captured evidence:

```javascript
// Private candidate-claim-evidence-sdk-copy-v2/stage-private/child-constructor.mjs:107
function assertClaimEvidence(input){
  knownSelection().assertCapturedIdentity(input);
  if(evidenceEligibilityFailure)throw new JudgmentConstructionError('Original relation evidence lost dependency eligibility',{cause:evidenceEligibilityFailure.cause});
  try{assertDependenciesCurrent();}
  catch(error){
    evidenceEligibilityFailure=Object.freeze({cause:error});
    throw error;
  }
}
```

Checking canonical identity first keeps copied or cross-claim records from poisoning genuine evidence.
A genuine shared-dependency failure retires all captured evidence in that original judgment.
The object sentinel also retains falsy thrown values rather than treating them as absence of failure.
This is evidence eligibility,
not a new registry or a policy verdict.

`proc_d959` checked the canonical-capture owner and its exact identity-guard omission.
`proc_7bc6` verified the repaired native suffix on SDK 1.0.2 and Node 26.10.0:
one session,
two local main requests,
one fake guard request,
and zero fixture executions.
It checked successful validation after inference-clock expiry,
changed/restored dependency refusal,
shared-claim retirement,
copy rejection before retirement checking,
persisted outcomes,
source hashes,
empty worker stderr,
and disposal.
`proc_f9b4` independently reconciled both failed namespaces without SDK replay.

### Rejected remedies and filing decision

Do not refresh the old judgment,
reset its budget,
use retained JSON as live evidence,
or waive a stale original request after its successor begins.
Moving the fixture check into the original callback repaired the placement error only;
it did not fix restoration eligibility.
The failure sentinel intentionally requires a new original judgment after a genuine eligibility failure.
It does not provide filesystem atomicity or detect every unobserved transient source change.

This is owned private integration code.
No Pi or Gateway fault was established,
so upstream fixability,
supported-use-case claims,
contribution acceptance,
and willingness do not justify an upstream filing.
The local repair is prototyped and verified;
no upstream issue or comment is warranted.

## Relevance canary and native hook diagnostics

### Symptoms and separate failures

The Pi 1.0.2 private relevance-hook worker `proc_6478` exited successfully.
Its verifier rejected the copied stdout constants of five sessions and ten requests.
The actual persisted result contained one session and four local requests.
The source discrepancy is explicit:

```javascript
// Private contract/collector/relevance-before-request-sdk-v3/probe.mjs:139, retained faulty summary
console.log(JSON.stringify({complete:true,SDKAgentSessions:5,localWireRequests:10,semanticAttempts:0,nativeReads:[4]}));
```

Read-only reconciliation `proc_e53e` checked the incorrect stdout exactly,
then verified actual counts from the completed result and persistence artifacts.
It also verified source hashes,
empty worker stderr,
disposal,
and question counts `[205, 0, 1, 0]`.
No successful SDK worker was replayed to fix its summary.

Do not merge this reporting error with the prior fixture failures:
`proc_f2a7` retained an unrelated 10,000ms synthetic clock offset into its second run;
`proc_e353` reported the cached view's creation-time question count on warm operations.
The corrected preprocessor reads the current operation's sender instead:

```javascript
// Private contract/lifecycle/rule-relevance-preprocessor-v2/boundary.mjs:35
const requestedRuleIds=transport?.record?.originalQuestionIDs??Object.freeze([]);
```

The later real relevance canary succeeded,
including warm and restarted-owner reuse,
as verified by `proc_f465`.
Its separate outer metadata checker printed:

```text
# Outer source/namespace checker, after its completion record
logger internal error: sink verification failed for entry 3: Timed out after 5000ms: sink 3 verify
```

The worker and immediate controller had empty stderr.
This diagnostic does not describe a Jev response failure or a tool-judgment deadline.

### Logger source path and verified workaround

`package/git/executable/src/resolve-real-git.ts:10` imports the incumbent tagged logger.
Its default Node sink order places the asynchronous file sink at index 3:

```typescript
// package/module/logger/src/default-sinks.node.ts:38
return [
  createConsoleSink(),
  createSessionStorageSink(),
  createLocalStorageSink(),
  createFileSink(),
];
```

`package/module/logger/src/create-logger.ts:351` starts each verification under a deadline:

```typescript
// package/module/logger/src/create-logger.ts:358
available: await withHostTimeout({
  label: `sink ${entryIndex} verify`,
  ms: verifyTimeoutMs,
  promise: entry.sink
    .verify(),
},),
```

The file sink awaits filesystem operations in `package/module/logger/src/sink/file.ts:169`.
The outer checker then synchronously waited for its child while logger startup could still be pending.
`proc_6308` isolated this mechanism on Node 26.10.0 with disposable homes and log directories:
blocking for 5,200ms after initiating the default logger reproduced the exact diagnostic;
awaiting `logger.flush()` before the same blocking child produced empty stderr.
Neither control contacted a provider or started an SDK session.

```javascript
// Private contract/collector/relevance-launcher-logger-controls/probe.mjs:10, consumer-side ordering remedy
if(mode==='drained')await logger.flush();
```

The workaround waits for incumbent sink verification and queued logging before blocking.
It does not filter stderr or remove logging.
Its tradeoff is waiting for the logger's bounded flush lifecycle;
it does not guarantee a failing filesystem sink becomes available.
The paid canary and its consumed launcher remain historical artifacts,
not targets for replay.

### Rejected remedies and upstream filing decision

Do not rewrite retained stdout,
reset consumed namespaces,
suppress the logger diagnostic,
or repeat the paid relevance request to repair launcher reporting.
These are owned fixture,
accounting,
and consumer lifecycle issues,
not demonstrated Pi or Gateway bugs.
Upstream fault is not established;
upstream fixability,
support,
contribution acceptance,
and willingness are therefore not grounds for a filing.
The consumer-side lifecycle remedy is prototyped and checked locally.
No upstream issue or comment is warranted by these observations.

## SDK 1.0.2 update retires installed 1.0.0 paths

A background Pi update removed the installed 1.0.0 package paths used by the completed private fixtures.
During that transition,
the live Codemode tool reported `Cannot find module 'quickjs-wasi/quickjs.wasm'`
with a 1.0.0 bundled-chunk require stack.
After the update,
a fresh live Codemode invocation succeeded and the installed Pi package directories were 1.0.2.
This records the interruption and recovery,
not a diagnosed upstream Wasm defect.

The old qualification namespaces and hashes remain unchanged.
`proc_fb7e` compared the latest listed-source manifest with current installed paths:
307 unique entries,
297 matching byte digests,
nine changed entries,
and one missing parser path.
The missing `yuku-parser@0.14.0` entry was replaced by an explicitly selected 0.17.0 entry
in fresh staging,
not by altering the old manifest.
These counts do not describe the full transitive dependency graph.

### Account for source changes before relocation

The SDK 1.0.2 session-source change was isolated to the HTML tool-renderer callback.
The fresh staging controller reverses the new callback to the old form
and requires the entire resulting file to match the historical digest:

```javascript
// Private contract/collector/sdk-1-0-2-paired-copy/stage.mjs:26, session delta check
assert.equal(sha(currentSession.replace(newLine,oldLine)),sessionChange.expected);
```

The old and new callback fields are:

```javascript
// SDK 1.0.0: dist/core/agent-session.js:3445, historical HTML renderer field
getToolDefinition: (name) => this.getToolDefinition(name),
```

```javascript
// SDK 1.0.2: dist/core/agent-session.js:3445
getToolRenderers: (name) => this._extensionRunner.resolveToolRenderers(name, () => this.getToolDefinition(name)),
```

The same delta is applied to the private session copy.
Other inspected changes include the extension renderer resolver,
AI sampling-parameter resolution,
and Codemode output limits.
Those changes are not qualified merely by an import-path replacement.
The upstream comparison is
[Pi 1.0.0 to 1.0.2](https://github.com/earendil-works/pi/compare/v1.0.0...v1.0.2);
the 1.0.2 release commit is `cd32f7725fdbddbaecdff5b1e68491563394e0ca`.

### Preserve separate failed staging attempts

The 26-artifact copy in `proc_59df` staged successfully,
but an import inspection found its separately shared private manager still referenced old installed paths.
No SDK worker had used that staging.

The manager relocation initially used the wrong manifest:
`proc_2f8f` failed its assertion that the manager pin was present in the parent graph inputs.
That pin belongs to the manager's own manifest.
The next attempt,
`proc_0681`,
used the right manifest but called `realpathSync` on every historical entry.
It reached a removed installed path and failed with `ENOENT` before finding the retained manager.

The corrected lookup selects the exact retained artifact path before reading its bytes:

```javascript
// Private contract/collector/sdk-1-0-2-closure-copy-v3/stage.mjs:9, manager lookup
managerPin=managerManifest.sources.find(entry=>entry.path===oldManager);
```

Its unchanged native manager source is checked separately against the owning historical digest.
`proc_c2ea` staged 27 artifacts and checked 45 reachable private literal-import modules
and 46 installed literal edges.
This is a bounded literal-import check,
not complete transitive attestation or runtime qualification.

Two dependent checks were started before the first manager staging had succeeded.
`proc_0801` failed with `ERR_MODULE_NOT_FOUND` before parsing;
`proc_e8a6` failed with `ENOENT` for the missing staging manifest before SDK import.
Those were orchestration errors,
not parser or SDK behavior failures.
Their original namespaces remain preserved.
Replacement checks started only after `proc_c2ea` had exited successfully
and its receipt was reconciled.

### Verified continuation and limits

The new parser profile,
`proc_7e8e`,
passed the existing bounded result-program assertions on parser 0.17.0:
six positive source forms,
four producer values,
17 source rejections,
five value rejections,
and two ownership rejections.
It created no SDK session.

The new SDK consumer,
`proc_89f9`,
passed one actual 1.0.2 session,
two injected requests,
one original canned assessment,
and two root definitions.
The intrinsic resource binding remained current after the decision deadline closed.
This does not replay or requalify every historical SDK matrix.

The updated SDK 1.0.2 path then passed `proc_35e7`:
three actual sessions,
six injected requests,
three original canned assessments,
child-entry counts `[3, 1, 1]`,
and sibling-root counts `[1, 0, 1]`.
This rechecks the result-bound successor and guard-versus-ordinary-error behavior
with parser 0.17.0 and the intrinsic resource collector.
It is targeted changed-dependency qualification,
not a claim that every historical SDK profile was rerun.

These phases use `mise --no-env --no-hooks run stage`
or `mise --no-env --no-hooks run check`
from their named directories under the private repository's `contract/collector/`.
Existing output namespaces are not replayable.
No installed package,
dependency lockfile,
or protected policy file was edited by this recovery.

The workaround is fresh source-checked relocation plus targeted changed-dependency verification.
Repointing old receipts,
recreating old installed directories,
assuming the staging manifest contains every shared dependency,
and treating process start as prerequisite completion are not accepted alternatives.
The staging failures were owned harness errors;
no upstream issue or fix is proposed.
The existing upstream-filing limits continue to apply.

## Owned fork consumer omitted a persisted system entry

### Symptom and evidence

The separate private fork mechanics controller `proc_90f8` failed after one second.
Node emitted `AssertionError [ERR_ASSERTION]` at the parent acceptance gate:
`Historical fork consumer failed; detailed diagnostics remain private; stop without replay`.
The child exited one without a signal or bounded stop,
with empty stdout and 818 bytes of private stderr.

Fixed-coordinate inspection `proc_5f79` identified the owned assertion at
`contract/lifecycle/fork-mechanical-controls/attachment.mjs:128`.
Strict role metadata reader `proc_2412` failed without exporting its rejected token.
Separately declared enum-only correction `proc_ef03` admitted:
`system/user/assistant/toolResult/assistant`.
The reference expected `user/assistant/toolResult/assistant`.
The consumed runtime reached the completed origin-session reference,
but rejected before actual fork construction.
Its child/reset suffix remains unqualified.

### Source cause and rejected premise

The error was in the owned consumer's four-role expectation,
not demonstrated upstream behavior failure.
The earlier source-only clearance missed the persisted-prefix premise.

Pinned Pi source `packages/coding-agent/src/core/agent-session.ts:1420`
constructs a structured system message when prompt sections change:

```ts
// packages/coding-agent/src/core/agent-session.ts:1420
return sections ? { role: "system", content: "", sections, timestamp: Date.now() } : undefined;
```

The same file at line 934 includes system messages in ordinary persistence:

```ts
// packages/coding-agent/src/core/agent-session.ts:934
event.message.role === "system" ||
event.message.role === "user" ||
event.message.role === "assistant" ||
event.message.role === "toolResult"
```

This source admits persisted system entries;
the private enum receipt establishes the actual fixture's leading role.
Those facts do not establish every section's producer,
configuration binding,
or authority.
Read-only source remains commit `f07218c4d4bbc12bef056a7058c3dd49dfe41abe`.

### Verification and next correction

The consumed command was `mise --no-env --no-hooks run probe`
from the private `contract/lifecycle/fork-mechanical-controls/` directory.
It must not be launched again.
The separate full closure freeze `proc_2cae` passed ten syntax checks,
not runtime correctness.
The completed root sensitivity controls remain a different passing catalog,
not evidence for added fork guards.

At the consumed failure frontier,
no verified fork correction had run.
A separately declared correction must preserve the exact SDK prefix,
ordered call/result/stop,
selected records,
complete branch JSON,
and original immutable evidence linkage.
Accepting a system role cannot admit instruction authority or a human grant.
Any configuration-bound prefix assertion needs its deciding getter/projection source,
not a guessed section schema.
Do not fix the consumed source,
filter away every system message,
or relabel an intact test as guard sensitivity.

### Separate corrected consumer result

The consumed source and runtime remain unchanged.
Separate `contract/lifecycle/fork-system-prefix-controls/` captures an opaque immutable origin prefix
and full branch JSON after completed SDK origin execution,
then validates exact message order with named positions.
Before child publication,
a private helper follows actual persisted parent links and checks selected path/prefix JSON.
Configuration-derived sections equality is not needed for copying consistency;
configuration fidelity and instruction authority remain unqualified.

Pure freeze `proc_ba0c` and eight-case synthetic acceptance/rejection `proc_16e6` passed.
New full digest intake `proc_bd33` and twelve-module freeze `proc_7264` preceded one protected runtime.
`proc_72e8` passed two actual SDK sessions,
four scripted responses,
two inert callbacks,
and one reserved fork:
exit zero,
stdout 1,058 bytes,
empty stderr,
no signal or bounded stop.
Both sessions had their own completed non-error persisted result;
origin reset and independent child reset preserved the described evidence/snapshot boundaries.
No external fetch/models,
fixture action,
or grant write occurred;
current human eligibility remained unestablished.
This fresh pass is not a replay or retroactive pass for `proc_90f8`.

Input rejection controls do not prove guard necessity or omission sensitivity.
Wrong-root/cross-owner capture,
ledger recapture,
and persisted-path rejection branches remain untested.
Full cache/target/source/deadline finalization,
raw-byte/complete-property freshness,
current human grants/directives,
and five-second preparation-inclusive handback remain open.

### Upstream filing decision

- Fault:
   the observed mismatch is the owned transcript expectation;
  no upstream defect is established.
- Fixability:
  intact consumer correction passed separately;
  sensitivity and complete finalization remain open;
  no upstream change is required by this evidence.
- Supported use:
   the inspected SDK persistence path explicitly includes system messages.
- Contribution policy:
   no external contribution is proposed.
- Maintainer disposition:
   not assessed because no defect or contribution is established.
- Prototype:
   no upstream patch is justified;
  the separate consumer epoch passed only its finite intact mechanical reference.

Nothing is filed or drafted upstream.
This incident does not establish current human-grant eligibility,
human-authorized transfer,
complete lifecycle coverage,
or five-second handback.

## Symptom

The private auto-mode SDK preparation controller stopped before evaluating package code:

```text
AssertionError [ERR_ASSERTION]: Dependency staging prerequisites unresolved; retain inventory
3 !== 0
```

The emitter was the owned `contract/sdk/inventory.mjs:89`,
not Pi,
pnpm,
or a provider.
Process `proc_1af5` retained its output before throwing.
It recorded missing declared `@aws-sdk/client-bedrock-runtime` and `@google/genai` dependencies,
and rejected `proper-lockfile` because its resolved directory was outside the external package store.
This was not an SDK startup failure.

This preparation incident is separate from the
[instruction-view observations](pi-instruction-snapshots.md)
and the unresolved historical preparation stall.
No production package,
lockfile,
policy,
or provider configuration was changed.

## Source identity

The private repository is `~/temp/agent/auto-mode-consumer-contract.mDLkyNoP`.
Private paths in this report are relative to it.
The nominal inventory is retained at `contract/sdk/sdk-dependency-inventory.json`,
SHA-256 `a4db9a8556e7dc3e272a58cea164cc16e749b121b9d922d06a05c95445429f05`.

The installed SDK and Pi AI versions are `0.87.1`.
Read-only upstream source is `~/temp/agent/pi-input-provenance-2026-09-26`,
commit `f07218c4d4bbc12bef056a7058c3dd49dfe41abe`.
`packages/ai/` paths refer to that checkout.
The host metadata controllers reported Node `v26.10.0`;
no SDK runtime was started by these inventories.

## Root cause trace

### The owned admission rule excluded the existing shim

The initial controller admitted only directories under `node_modules/.pnpm`:

```javascript
// Private contract/sdk/inventory.mjs:42
const fromStore = relative(store, path);
if (fromStore === '..' || fromStore.startsWith(`..${sep}`)) {
  failures.push({ path, reason: 'dependency resolves outside the installed external package store' });
  continue;
}
```

Repository configuration intentionally selects a different owner:

```yaml
# pnpm-workspace.yaml:358
'proper-lockfile': 'link:package/shim/proper-lockfile'
```

The [existing removal decision](../decision/proper-lockfile-removal.md)
and [dependency audit](dependencies.md)
already document this substitution.
The current shim's `package.json:24` declares no runtime dependencies.
Its current `index.cjs:3` imports Node filesystem,
timer,
and path builtins:

```javascript
// package/shim/proper-lockfile/index.cjs:3
const { mkdirSync, rmdirSync, } = require('node:fs',);
const { setTimeout: sleep, } = require('node:timers/promises',);
const { dirname, basename, resolve, } = require('node:path',);
```

The remedy is to preserve and bind this exact owner,
not silently omit it or restore the upstream dependency.
No general claim of shim parity is established by reading its metadata.

### Published declarations are not the effective workspace selection

The initial controller combined package dependency declarations
and treated every unresolved non-optional declaration as a staging failure:

```javascript
// Private contract/sdk/inventory.mjs:56 and 63, selected statements
const declared = { ...metadata.dependencies, ...metadata.peerDependencies, ...metadata.optionalDependencies };
else failures.push({ ...record, reason: 'required installed dependency missing' });
```

Current repository configuration explicitly removes the reported cloud SDK edges:

```yaml
# pnpm-workspace.yaml:234
'@earendil-works/pi-ai>@aws-sdk/client-bedrock-runtime': '-'
'@earendil-works/pi-ai>@google/genai': '-'
```

The reviewed configuration hash is
`4a6a413b76bc2d6cea134bffd552f7eb77668aea9710bba29b70ef48a191b55c`.
The original controller's store-only and all-declarations-installed assumptions
were not valid for this configured graph.
The inventory did not demonstrate that these packages were needed by the planned scripted provider.

### Lazy provider entry points are narrower evidence than startup qualification

Current source defers the Google implementation imports:

```typescript
// packages/ai/src/api/google-generative-ai.lazy.ts:4
export const googleGenerativeAIApi = (): ProviderStreams => lazyApi(() => import("./google-generative-ai.ts"));
```

```typescript
// packages/ai/src/api/google-vertex.lazy.ts:4
export const googleVertexApi = (): ProviderStreams => lazyApi(() => import("./google-vertex.ts"));
```

`packages/ai/src/api/bedrock-converse-stream.lazy.ts:26` similarly supplies
an asynchronous implementation loader to `lazyApi`.
The loader is called from the streaming paths:

```typescript
// packages/ai/src/api/lazy.ts:73, selected statements
stream: (model, context, options) =>
  lazyStream(model, async () => (await load()).stream(model, context, options)),
streamSimple: (model, context, options) =>
  lazyStream(model, async () => (await load()).streamSimple(model, context, options)),
```

The installed compiled lazy-route files were also inspected and hashed.
This supports retaining the configured removals for the proposed scripted-provider path.
It does not prove complete static reachability,
actual package import success,
or availability of the removed providers.
An unexpected attempt to use a removed route must stop the probe,
not install dependencies or fall back to another provider.

## Verification

These are recorded private invocations,
not replay instructions:

```bash
# Private contract/sdk
mise --no-env --no-hooks run inventory
```

```bash
# Private contract/sdk/effective
mise --no-env --no-hooks run compose
mise --no-env --no-hooks run files
```

```bash
# Private contract/sdk/topology
mise --no-env --no-hooks run collect
```

The original inventory stopped with 54 external package records and 26 missing optional declarations.
The separate effective composition passed with 55 package roots,
including the measured shim,
while retaining every original failure and its disposition.
It verified the retained inventory hash,
reviewed override configuration,
current package metadata,
and exact shim code.

The file walk recorded 11,850 candidate files totaling 119,118,689 bytes,
no package-content symlinks,
and 11 skipped package-internal `node_modules` directories.
These are candidate filesystem entries,
not an admitted package-byte snapshot or hermetic runtime closure.

The separate topology collector recorded 96 declared edges:
68 existing symlink lookups,
2 configured cloud SDK removals,
22 absent non-Linux-x64 esbuild platform packages,
and 4 absent optional peers.
The peers are Anthropic's `zod`,
OpenAI's `ws` and `zod`,
and `proxy-agent-negotiate`'s `kerberos`.
The optional entries were not additional Pi removal overrides.

### Clean observations

- Current resolved targets still matched the retained package identities.
- Previously absent edges remained absent.
- The existing shim was admitted explicitly without broadening access to arbitrary workspace packages.
- The follow-on walk inspected the skipped directories within its fixed entry and byte caps.
- No SDK code,
  external model,
  native addon,
  session,
  or represented operation was executed.

### Rejected assumptions and artifact exclusions

- The nominal inventory failed its external-store-only and required-declaration gates.
- The skipped directories were not interchangeable with the adjacent dependency-link directories.
  They contained generated executable wrappers and local logger artifacts.
  The collector retained names,
  sizes,
  and hashes,
  not raw log contents.
  Neither category should be copied into the SDK probe automatically.
- The candidate shim subtree included a TypeScript build cache and workspace build configuration.
  Staging must select the shim's runtime files,
  declarations,
  documentation,
  and licenses rather than copying the cache or build configuration.
- Staged resolution,
  native/Wasm compatibility,
  and actual import/startup remain unverified.

### Selected artifact bytes

The separate `contract/sdk/artifacts/freeze.mjs` phase completed once in `proc_490f`.
It selected and hashed 11,847 files totaling 119,045,169 bytes
and retained 68 dependency lookup placements.
It excluded the shim's `mise.toml`,
`tsconfig.json`,
and TypeScript build cache;
none of the skipped logger artifacts or executable wrappers was admitted.

The create-new manifest is `contract/sdk/artifacts/manifest.json`,
SHA-256 `d9df0286368eecc8a54f826c80b2524f5eb22344085ed5cd9cdd84d2ec86e1e3`.
This establishes listed artifact-byte identity before staging,
not publisher authenticity,
a copied image,
or actual SDK execution.
A later policy freshness check found a changed `AGENTS.md`;
the [separate policy-epoch intake](../handover/pi-auto-mode-axiom-evaluation.md#policy-freshness-checkpoint)
must precede the SDK probe.
The dependency-byte inventory does not refresh the policy evidence.

## Verified workaround and remaining gates

`contract/sdk/effective/compose.mjs` is the verified metadata-level workaround.
It consumes the original result in a new output namespace,
binds the reviewed configuration and shim,
and gives the original failures explicit dispositions.
Its tradeoff is a deliberately restricted scripted-provider profile,
not general SDK dependency completeness.
No completed constructor or stopped original inventory was replayed.

Before SDK execution,
copy the admitted artifact bytes with hash checks,
preserve measured lookup topology,
verify staged resolution and required-dependency omission controls,
and bind the actual runtime and image identity.
Use a read-only image with declared disposable tmpfs for writable session state,
not host state mounts.
Seal the invocation,
transcript,
provider,
resource,
and lifetime caps before session construction.

## Module-preflight environment admission

The first actual-module preflight `proc_0e8c` stopped at the owned probe's assertion:

```text
Unexpected environment variable names
```

This occurred before SDK import.
A separate names-only diagnostic `proc_bf98` found `HOSTNAME`
besides the explicitly configured probe variables,
`HOME`,
and `PATH`.
No environment values were printed.
The installed tool reported Podman `5.8.7`.

The read-only source checkout is `~/temp/agent/podman-sdk-env-5.8.7`,
commit `c593b672bf3db1173aebea565ebf1a724ea196dc`.
Its default-environment processing clears defaults:

```go
// Podman pkg/specgen/generate/container.go:222
if s.UnsetEnvAll != nil && *s.UnsetEnvAll {
    defaultEnvs = make(map[string]string)
}
```

At line 240 it combines those defaults with explicit environment values.
Later hostname handling checks whether an explicit value already exists:

```go
// Podman libpod/container_internal_linux.go:537
needEnv := true
for _, checkEnv := range g.Config.Process.Env {
    if strings.SplitN(checkEnv, "=", 2)[0] == "HOSTNAME" {
        needEnv = false
        break
    }
}
if needEnv {
    g.AddProcessEnv("HOSTNAME", hostname)
}
```

The owned assumption that `--unsetenv-all` left only the enumerated explicit names was wrong.
The correction is not to admit arbitrary environment variables.
The new `contract/sdk/module-preflight-hostname` epoch supplies
`--env=HOSTNAME=sdk-preflight`,
requires that exact synthetic value,
and still rejects every other unexpected name.
Its diagnostic names unexpected keys without exposing values.

`proc_4708` passed both fixed cases:

- The intact image verified recorded bytes,
  links,
  package lookup/absence edges,
  and the resource envelope,
  then imported the real SDK barrel and observed the expected exported APIs.
- The preserved throwaway image with only TypeBox's package metadata removed
  failed the same SDK import with `ERR_MODULE_NOT_FOUND` naming TypeBox.
  This control intentionally was not admitted as an intact artifact.

Both cases observed Node `v26.10.0`,
2 GiB memory,
zero extra swap,
2 CPUs,
64 PIDs,
read-only root,
and loopback-only networking.
They used declared disposable tmpfs and a synthetic home.
Stderr was empty and the fetch counter stayed zero.
No `AgentSession` was constructed and no external model call ran.
The original failed epoch and unused original control schedule remain preserved;
the existing omission image was reused rather than rebuilt.
This qualifies the measured module-import boundary,
not actual session lifecycle,
human-input authority,
or every native/API path.

No Podman source or host configuration was modified.
No upstream contribution is proposed for the owned allowlist correction;
no claim about absence of an upstream issue or contribution policy is made.

## Fixture import-condition correction

The first actual-session attempt `proc_5d43` stopped before constructing any session:

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in .../@earendil-works/pi-ai/package.json
```

Node's stack identifies `require.resolve` at the owned `contract/sdk/session/probe.mjs:41`.
The fixture first imported the SDK barrel successfully,
then incorrectly used a CommonJS resolver to select Pi AI's helper entry:

```javascript
// Private contract/sdk/session/probe.mjs:41
const ai = await import(pathToFileURL(require.resolve('@earendil-works/pi-ai')).href);
```

The staged Pi AI `0.87.1` package metadata declares an import-only root condition:

```jsonc
// Staged @earendil-works/pi-ai/package.json:13, selected root export.
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

This is the owned resolver choosing the wrong public condition,
not missing SDK files or an instruction-view finding.
It does not establish a general inability to use ESM from CommonJS.
The separate `contract/sdk/session-esm` correction follows the already verified dependency edge,
checks the published `exports['.'].import` target,
and imports that file URL.
The original failed epoch remains unchanged.
The case-reference hashes remain identical:
`9acfe7b38a559b9044dceeed88b24c4caf5886d46093d0087f2743de9fa83020`.
No expectation was relabeled to pass.
The corrected phase passed all 4 actual-session cases in `proc_da53`,
with 8 scripted responses,
4 inert tool executions,
empty stderr,
and zero fetch or external model calls.
`proc_a79f` reconciled the saved raw outputs and unchanged references without replay.
Result SHA-256:
`18ae734862240c7c28d7fb235cfce2972f6de015841311fcf0c45762f8a17e98`.
The [SDK observations](pi-instruction-snapshots.md#actual-sdk-session-observations)
record the measured instruction-view differences and remaining authority limits.

### Current requester repeats the import-condition mistake

The private current-requester stage `proc_c9c9` failed under Node `26.10.0`
before SDK imports,
terminal launches,
or human responses.
Node emitted `ERR_PACKAGE_PATH_NOT_EXPORTED`
for the installed Pi coding-agent `1.0.2` root export.
The failing call was again a CommonJS resolver:

```javascript
// Private contract/human-origin/current-requester-copy/stage.mjs:18
const resolved=require.resolve(specifier);
```

The installed coding-agent `package.json` has the same root shape shown for Pi AI:
an `import` target,
but no `require` or `default` target.
The current recovery inspects that metadata instead of interpreting resolver failure as a missing package:

```javascript
// Private contract/human-origin/current-requester-copy-v2/stage.mjs:20
const target=specifier==='@earendil-works/pi-tui'
  ? (assert.equal(metadata.exports,undefined),metadata.main)
  : metadata.exports['.'].import;
```

This selector is restricted to the inspected SDK,
TUI,
and TypeBox imports,
not a general Node resolution algorithm.
The fresh stage passed as `proc_aed8`;
the subsequent pre-spawn instrumentation stage passed as `proc_4363`.
`proc_3e9a` executed the current requester with its actual default launcher and request-owned helper
using disposable scripted terminal/editor inputs.
Its approved,
denied,
and blank-response paths completed with empty helper stderr and removed answer workspaces.
That result verifies this current consumer profile,
not a genuine human origin or permission.

The failed stage remains unchanged.
No dependency installation,
installed package edit,
or upstream fix was needed.
The upstream-filing decision remains unchanged:
this was an owned resolver mistake,
not a demonstrated Node or Pi defect.

## Owned documentation renderer dependency-path drift

The `proc_2b5e` handoff renderer failed under Node `v26.10.0` with `ERR_MODULE_NOT_FOUND`:
its absolute `micromark@4.0.2` import no longer existed.
The failing owned import is retained:

```javascript
// Private contract/sdk/docs/render-confirmation-handoff.mjs:5
import { micromark } from '/var/home/user/Monochromatic/node_modules/.pnpm/micromark@4.0.2_supports-color@10.2.2/node_modules/micromark/index.js';
```

An uncapped `find node_modules -type d -name micromark` found the existing `4.0.3` package.
The installed declarations were read before invoking it.
A separate `render-confirmation-handoff-current.mjs` changed only the consumer's import coordinate
and passed the complete handoff render and heading/key/emphasis assertions through
`mise --no-env --no-hooks run confirmation-handoff-current:render`.
The old failed renderer and diagnostic are preserved.
No installation,
lockfile edit,
production linter patch,
SDK restaging,
or frozen genuine-input change was made.

This is an owned stale import coordinate,
not an established micromark or package-manager defect.
The concurrent lockfile change does not identify the actor or mechanism that removed the old package directory.
The tradeoff is renderer version `4.0.3` for this separate documentation check;
old renders and frozen runtime references are not silently refreshed.
Do not use the obsolete absolute coordinate or claim the new render proves semantic equivalence.
No upstream filing or upstream-fix prototype is justified by this consumer mistake.

## What does not work

Treating every nominal dependency declaration as a mandatory installation
would undo intentional repository selection.
Treating every workspace-resolved package as inadmissible would discard the incumbent shim.
Neither assumption is repaired by installing another provider,
rewriting the lockfile,
or editing upstream source.
Those changes were not attempted.

A package name,
manifest hash,
or successful metadata walk does not prove actual SDK startup,
complete instruction coverage,
or genuine human authority.

## Upstream filing artifact

Nothing is filed or drafted.
The diagnostic came from the owned inventory's admission assumptions,
not an established upstream defect.
The existing dependency decision and audit already cover the configured removals and shim.

### Upstream filing decision

1.  Upstream fault is not established;
    the rejecting controller is owned private preparation code.
2.  The measured remedy belongs in consumer staging,
    not an upstream package modification.
3.  Pi's SDK and custom-provider surfaces are supported;
    this exact staged profile still needs actual execution verification.
4.  The previously inspected pinned `CONTRIBUTING.md` requires understood contributions
    and appropriate human-voice or disclosed AI participation.
    No contribution is proposed here.
5.  No maintainer refusal or willingness is inferred from a local inventory failure.
6.  No upstream patch was prototyped because there is no upstream defect target.
    The tested artifact is a separate owned metadata composition.

No new upstream tracker search was used to claim absence of an issue.
A future upstream filing would require its own scope,
duplicate,
contribution,
and demonstrated-fix checks.

## Separate lifecycle API intake stop and staged diagnostic

### Symptom and established boundary

The new synthetic SDK API intake `proc_256c` stopped at its 15-second child bound.
Its outer Node driver emitted
`AssertionError [ERR_ASSERTION]: SDK API intake failed; synthetic diagnostics retained privately; no replay`.
Retained outcome metadata reports child status null,
`SIGTERM`,
`ETIMEDOUT`-based bounded stop,
and empty private stdout/stderr.
No synthetic fixture-cwd or session-files directory was created.
No actual SDK session-manager instance,
provider,
model,
genuine original,
or GUI interaction was reached.
The failed epoch is preserved without replay.

### Source trace and cause limit

The owned `contract/lifecycle/api-intake/run.mjs:21` launches Node with
`timeout: plan.childDeadlineMs` and private file-backed stdout/stderr.
Its `run.mjs:23` records `child.error?.code === 'ETIMEDOUT'`.
The worker's `probe.mjs:17` verifies every retained dependency file before importing the SDK.
`probe.mjs:25` then awaits the SDK barrel;
`probe.mjs:27` creates the synthetic fixture directory before
`probe.mjs:28` constructs the first `SessionManager`.
These are private qualification-repository paths,
not production changes or upstream patches.

```javascript
// Private contract/lifecycle/api-intake/probe.mjs:25 to 28
const { SessionManager } = await import(pathToFileURL(join(staging, 'repository', manifest.sdkRoot, 'dist/index.js')).href);
const fixtureCwd = join(privateRoot, 'fixture-cwd');
mkdirSync(fixtureCwd, { mode: 0o700 });
const manager = SessionManager.inMemory(fixtureCwd);
```

This places the recorded stop before API construction,
not at a reset,
fork,
or permission decision.
The original worker had no stage markers;
dependency validation versus import versus filesystem setup remains unassigned.
Empty output alone does not identify a cause.

### Verification and non-workaround result

A distinct staged diagnostic `proc_0a95` used the same retained SDK graph and a 60-second bound
within the historical SDK consumer envelope.
It constructed no session manager and did not replay any original lifecycle API check.
It checked 11,847 dependency files,
completed the barrel import and synthetic directory creation,
and exited zero with empty private stderr.
Its observed cumulative dependency/import completion times were
`5299.591325` ms and `5777.045059` ms.
These are this diagnostic's observations,
not a timing comparison or proof of the original stage/cause.

The clean catalog is the separately staged graph/import/setup diagnostic.
The failing catalog is the preserved original bounded stop with no fixture directory.
A larger bound is not established as a fix for that original incident.
No SDK API,
permission lifecycle,
producer coverage,
or five-second handback claim follows from the diagnostic success.
Unopened API checks require a separately declared namespace and their own outcome.

### What does not work

- Replaying the consumed original probe would destroy its once-only history.
- Inferring import failure from absent stdout skips dependency checking and setup.
- Calling the later successful diagnostic a reproduced fix would conflate distinct runs.
- Treating copied session headers or IDs as authority would bypass original-source admission.

### Upstream filing decision

No upstream defect or fileable draft is established.
The existing pinned source clone remains read-only.
The failure is at an owned diagnostic boundary,
not an identified SDK or Node implementation path.
Upstream fault,
a supported failing API use case,
a deciding source cause,
contribution/maintainer acceptance,
a compatible tested fix,
and duplicate-tracker applicability remain unestablished for this incident.
No vendor contact,
account change,
or upstream filing was made.

## Scoped Git source-frontier commit rejection

### Symptom

During the pure prefix source handoff,
`proc_7306` failed with exit code 128 at `git add`.
Its diagnostic was:

```text
fatal: Unable to create '<private repository>/.git/index.lock': File exists.
```

The repository path is redacted;
the original diagnostic remains in retained process logs.
`git --version` subsequently reported Git `2.55.0` with the configured `cli-git` wrapper.
This is separate from earlier renderer receipt lock incidents.
The source smoke `proc_29bd` passed;
a rejected documentation commit is not a failed source test.

### Owned dispatch and cause limit

The assistant dispatched receipt commit `proc_28ae` and frontier commit `proc_7306`
concurrently against the same private repository.
The receipt writer completed successfully.
The rejected command identifies the index-lock path,
not its actual owner or whether it was stale.
No lock owner,
upstream defect,
or source-level Git cause is established.
Future owned writers are serialized rather than treating concurrency as harmless.

### Verification and recovery

Scoped `git status --short` showed the frontier `README.md` modified and the source-check `README.md` untracked.
Scoped `git log` had no commit for the new source-check document.
A subsequent `git rev-parse --verify HEAD` returned `73f68daf332837a08b21b2f35d0a46adb4ab7f88`;
`test ! -e .git/index.lock` passed.
After observing the receipt writer's completion,
`proc_9aca` committed the already existing documents and incident note with explicit scoped paths.
No lock was removed and no source smoke or renderer was replayed.
The failed catalog is `proc_7306`;
the clean catalog is the inspected existing-document recovery `proc_9aca`.
Recovery establishes this scoped retention,
not general Git process-tree or lock-owner guarantees.

### What does not work

Blindly repeating a commit can duplicate an ambiguous success.
Removing an unassigned lock can interfere with another writer.
Rerunning a consumed test or renderer cannot repair a rejected Git operation.
Scoped document retention is not global worktree cleanliness.

### Upstream filing decision

Nothing to add or file:
upstream fault,
a deciding implementation cause,
a supported failing Git use case,
contribution acceptance,
maintainer response,
and a compatible tested upstream patch are unestablished.
No source clone,
account change,
vendor contact,
or upstream mutation is needed for this owned command-serialization correction.

## Owned command-result admission after a root-cwd rejection

### Symptom and source

The persisted source-smoke preflight ran `git diff` from `contract/lifecycle`.
The configured `cli-git` wrapper returned `require-root/not-at-root`,
exit code one,
before Git diff or the chained namespace-absence test ran.
The owned boundary is `package/git-policy/cli/src/rule/require-root.ts:181`:

```typescript
// package/git-policy/cli/src/rule/require-root.ts:181 to 187
if (repoRoot !== effectiveCwd) {
  throw new RequireRootViolationError(
    `cli-git: not at the root of the git repository. `
      + `Repo root is ${repoRoot} but effective cwd is ${effectiveCwd}. `
      + `Tip: cd to ${repoRoot} or pass -C ${repoRoot} before the subcommand.`,
  );
}
```

The orchestration awaited the returned tool object but did not gate on its exit status.
It then falsely described the diff and namespace checks as successful and dispatched the pure source smoke.
This is an owned orchestration failure,
not a broken Git root guard.

### Verification and authoritative correction

The failing catalog is the recorded preflight exit one.
The clean catalog is the subsequent scoped root-cwd `git diff` returning zero.
That later measurement is post-dispatch,
not retroactive evidence that the skipped checks ran.
The pure new-baseline smoke itself passed once as `proc_7dd8`:
all ordered aggregate movements,
four direct domain rejections,
exit zero,
no signal,
stdout 427 bytes,
and stderr zero.
Complete prior body review,
successful predispatch byte hashes,
validated fixed worker projection,
and matching post-run sources support that finite source result.
They do not turn the failed admission procedure into success.
`preflight-git-scope-correction.json` and `result-disposition.json` retain the authoritative scope;
the original false metadata and consumed code remain preserved.

### Prospective correction and rejected approaches

Require each prerequisite command's successful exit status before dependent claims or dispatch.
Tool-response fulfillment is not command success.
For `bash`,
inspect `exit_code` explicitly;
an intended failure needs its own predeclared accepted result.
Use repository-root cwd for scoped Git operations.
Later measurements must retain their actual observation time.
Do not erase false historical metadata,
repeat consumed source tests,
or treat create-new markers as complete historical namespace proof.
The [instruction-tightening proposal](../planning/pi-command-result-admission.md) is unaccepted;
`AGENTS.md` remains untouched.

### Upstream filing decision

Nothing to add or file:
the deciding guard is owned source and rejected the observed non-root cwd.
An upstream failing use case,
upstream root cause,
maintainer/contribution acceptance,
upstream fix necessity,
and compatible upstream prototype are not established.
No clone,
account change,
vendor contact,
or upstream mutation follows from the owned exit-status correction.

## Owned read-only checkpoint rejected native normalization

### Symptom and source

The consumed read-only document checkpoint,
`proc_78cc`,
stopped with Node 26.10.0 exit code 1:

```text
// Owned private contract: contract/sdk/docs/render-combined-source-policy-correction.mjs:22
AssertionError [ERR_ASSERTION]: Read-only checkpoint must not rewrite audit or any documentation
```

Its owned assertion compared the native formatter result with unchanged input:

```javascript
// Owned private contract: contract/sdk/docs/render-combined-source-policy-correction.mjs:22
assert.equal(fixed.source, bytes.toString('utf8'), 'Read-only checkpoint must not rewrite audit or any documentation');
```

The audit HTML was created before the handover comparison failed.
No completed checkpoint receipt existed for that run.
This is a consumer assumption failure,
not evidence of a Node or Sätteri defect.

### Verification and recovery

A separately named renderer,
`render-combined-source-policy-correction-normalized.mjs`,
used the already qualified native-coordinate formatter.
It kept the historical audit read-only,
allowed native formatting of other task documents,
checked source freshness before replacement,
and created new source-path-hashed HTML artifacts.

`proc_95b6` exited successfully with 31 rendered documents and zero native diagnostics.
The retained receipt is
`contract/sdk/docs/combined-source-policy-correction-normalized-result.json`.
It explicitly leaves audit-context compatibility unvalidated.
No genuine witness inputs were read;
`AGENTS.md` and the retiring Markdown linter were unchanged.

### Rejected approaches and upstream filing decision

Do not rerun the consumed renderer,
delete its audit HTML,
weaken the native linter,
or infer a complete pass from its partial artifact.
The new renderer namespace preserves the failed attempt.

No upstream filing:
the failed assertion was owned consumer code.
There is no established upstream defect,
supported upstream change request,
or upstream patch to evaluate.

## Owned fork source-accounting and encoded import boundary

### Symptom and source

Independent draft review found that counters called constructor invocations actually counted owner-delegate entries.
It also found a replacement-string boundary after URL/JSON encoding and a masked extra-system test.
These were owned prototype defects,
corrected before the new source smoke was consumed.
They do not establish an SDK defect or previously executed allocation failure.

In the private qualification repository,
`contract/lifecycle/fork-sensitivity-controls/fork-owner-wrapper.mjs:50` records a boundary request before admission.
Its delegate counter at line 56 records entering the owned factory,
not observing an SDK-internal constructor:

```javascript
// Private contract repository: contract/lifecycle/fork-sensitivity-controls/fork-owner-wrapper.mjs:50 to 57
childRequests += 1;
if (!configured || returnedRoot === undefined) throw new SyntheticForkFixtureError('Declared synthetic origin construction is unavailable');
if (originManager !== returnedRoot) throw new SyntheticForkFixtureError('Declared synthetic fork source is not the returned origin manager');
assertBaselineOwnedManager(originManager);
if (childReserved) throw new SyntheticForkBudgetError();
childReserved = true;
childOwnerDelegateCalls += 1;
const manager = forkBaselineOwnedManager(originManager);
```

The controlled fault follows the owned returned child,
not an SDK-internal allocation-then-throw event.
The recovered child cannot be relabeled as successful ledger publication.
The import fix is at `contract/lifecycle/fork-sensitivity-controls/encoded-owner-import.mjs:7`:

```javascript
// Private contract repository: contract/lifecycle/fork-sensitivity-controls/encoded-owner-import.mjs:7
return source.replace(selector, () => JSON.stringify(pathToFileURL(ownerPath).href));
```

The callback preserves encoded path text as data rather than replacement directives.
The corrected extra-system reference test supplies a valid frozen return and checks capture was never called;
a malformed return can no longer mask that rejection.

### Verification and limits

One separately declared source-only `proc_d55f` passed on the pinned Node v26.10.0 runtime:
exit zero,
stdout 494 bytes,
stderr zero,
and no signal.
Its working catalog includes eight parsed ledger variants,
four dedicated mock wrapper copies,
six fork classifier rows,
two recapture rows,
and thirteen source/JSON import-literal cases.
The unsafe string-replacement positive control differs for a dollar replacement token.
The rejection catalog includes unknown errors,
sink failure,
pair-inappropriate domain errors,
invalid ledger permission metadata,
malformed recapture output,
and extra system entries.

The actual SDK owner is only read/pinned;
all twelve loaded wrapper modules are mock-bound.
Ledger guards were not behaviorally exercised.
The new decoder originals are synthetic,
not a configured-host human witness.
The real body-identity gate compared complete reviewed tool-read sources against dispatch bytes.
Successful root-cwd Git and checked creation boundaries were explicitly admitted before dispatch.
The consumed task was `mise --no-env --no-hooks run check` from `fork-source-check/`;
do not rerun it.
SDK imports,
genuine originals,
models,
grants,
and represented actions are zero.

### Rejected interpretations and next verification

Do not equate delegate entries with constructor or complete internal-allocation counts,
return events with unique identities,
fault recovery with published inheritance,
or source literal round trips with filesystem confinement.
Mock rows and imported ledger variants do not establish actual SDK guard sensitivity.
Helper recovery and documented invalid configuration/delegate/return branches remain unexercised.
The shared actual SDK closure needs a new review,
freeze,
and bounded phase with own callback/result/persistence/stop/idle observations.
The worker old-space,
post-exit stream-size,
and timeout controls do not establish total memory,
live-write caps,
or parent-stall resistance.

### Upstream filing decision

Nothing to add or file.
The deciding counters,
interpolation,
and reference-test isolation are owned code.
An upstream defect,
upstream fix necessity,
supported upstream failing use case,
contribution acceptance,
maintainer response,
and compatible upstream patch are not established.
No external source edit,
account change,
vendor contact,
or upstream mutation follows from this source-only correction.

## Owned Mise 2026.9.12 descriptor contrast assumed non-inheritance

### Symptom

The normal-task negative `proc_fddd` exited one.
Node 26.10.0 emitted `AssertionError [ERR_ASSERTION]` at the owned
`sdk-startup/fd-pair-control/check.mjs:20:8`:

```text
// Private contract: combined-sdk-phase/sdk-startup/fd-pair-control/check.mjs:20
Expected values to be strictly equal:
true !== false
```

Mise also printed `[normal] ERROR task failed`.
The control expected both descriptors not to match their private files merely because the task lacked `raw = true`.
The stdout comparison was true.
The stderr assertion was not reached,
and no accepted negative projection was produced.

### Root cause and source trace

The failed assumption was owned:
absence of `raw = true` does not imply piped output.
The installed `mise --version` reported `2026.9.12 linux-x64 (2026-09-20)`.
The deciding published `v2026.9.12` sources were inspected read-only.

`src/cli/run.rs:1284` obtains the dependency graph's linearity:

```rust
// Mise v2026.9.12, src/cli/run.rs:1284
self.is_linear = tasks.is_linear();
```

`src/task/task_output_handler.rs:554` permits interleaved output for a linear graph without raw mode:

```rust
// Mise v2026.9.12, src/task/task_output_handler.rs:554 to 558
if self.raw(task) || self.jobs() == 1 || self.is_linear {
    TaskOutput::Interleave
} else {
    TaskOutput::Prefix
}
```

`src/task/task_executor.rs:1790` permits inherited descriptors when raw mode is false but redactions are empty:

```rust
// Mise v2026.9.12, src/task/task_executor.rs:1790 to 1797
} else if raw || redactions.is_empty() {
    if !task.silent.suppresses_stdout() {
        cmd = cmd.stdout(Stdio::inherit());
    } else {
        cmd = cmd.stdout(Stdio::null());
    }
    if !task.silent.suppresses_stderr() {
        cmd = cmd.stderr(Stdio::inherit());
```

The one-task control defines no dependencies.
Its measured global `raw` setting was false and `jobs` was eight;
`settings get task.output` returned `Setting [task.output] is not set`.
The failed control is consistent with the source's linear-graph inheritance path,
not evidence that Mise ignored an output guarantee.

### Verification catalog

The consumed raw controls `proc_2662` and `proc_f108` exited zero.
The former checked only stdout.
The latter checked both actual descriptors against their named files and returned
`stdoutBound: true` and `stderrBound: true`.
Both retained Mise command echoes privately.

The normal-task negative `proc_fddd` is the failing catalog.
Its frozen expectation and original output remain unchanged.
It is not replayed or relabeled.
These controls contain no SDK imports,
genuine input reads,
models,
grants,
or represented actions.

The fresh `sdk-startup/fd-identity-control/plan.json` declares a different contrast:
matched destinations first,
then distinct existing decoy destinations,
with independent expected pairs `[true, true]` and `[false, false]`.
The fresh positive `proc_2a24` and negative `proc_1506` each exited zero with their exact expected projection.
That independently declared contrast adds prospective evidence;
it does not repair or relabel `proc_fddd`.

### Verified boundary and tradeoffs

The consumed raw positive establishes descriptor identity for its own invocation.
The prospective caller redirects the entire Mise startup into precreated private files.
The builtin startup gate additionally compares its actual descriptors using
`fstatSync()`,
device,
and inode before importing the controller.

This preserves parsing and loader diagnostics privately.
It does not establish total memory,
live disk-write bounds,
startup timing,
or descriptor identity for an invocation that has not run.
A false decoy comparison alone does not identify the actual destination or prove it is regular.

### What does not work

- Treating `raw = false` as the complement of descriptor inheritance.
- Checking named file modes without comparing inherited descriptor identities.
- Counting an assertion failure as an accepted negative result.
- Replaying a consumed control or replacing its frozen expectation.
- Running the startup gate as a harmless preflight:
  it imports the controller and launches the actual phase.

### Upstream filing decision

Nothing to add or file.

- Upstream fault:
  not established;
  the failed expectation was owned and published source permits the observed behavior.
- Upstream fix:
  unnecessary for this caller-owned admission boundary.
- Supported failing use case:
  no violated output guarantee was established.
- Contribution acceptance:
  not investigated because no upstream change is proposed.
- Maintainer willingness:
  not investigated because no upstream defect is claimed.
- Compatible upstream patch:
  none;
  the separately declared correction belongs in the owned control.

No upstream source edit,
issue,
comment,
or vendor contact follows.

## Owned GNU install 9.10 argument grouping stopped preparation

### Symptom and evidence boundary

The prospective SDK-ID caller created an empty `0700` preparation directory,
then rejected its destination-file command before source-data admission or SDK startup.
The original command's stderr was not retained in the model-visible transcript.
Do not substitute a later control's diagnostic for that historical receipt.

The owned command passed `/dev/null`,
`stdout`,
and `stderr` as operands to one `install` invocation.
Installed GNU coreutils 9.10 documents `SOURCE DEST` and `SOURCE... DIRECTORY` in `install --help`.
That operand grouping is not two destinations.

### Verification and correction

Fresh disposable controls ran independently of the consumed namespace.
Two separate `SOURCE DEST` invocations exited zero and produced distinct empty `0600` regular files.
The failing control supplied an absent final destination:
it exited one with `install: target 'missing-destination': No such file or directory`.

```sh
# Fresh disposable GNU install grammar fixture, not an existing consumed namespace.
fixture=$(mktemp --directory)
install --mode=600 /dev/null "$fixture/stdout"
install --mode=600 /dev/null "$fixture/stderr"
stat --format='%a:%F' -- "$fixture" "$fixture/stdout" "$fixture/stderr"
install --mode=600 /dev/null "$fixture/missing-second-source" "$fixture/missing-destination"
```

Individual destination commands preserve stdout/stderr separation.
Their success is not inherited descriptor identity:
the invoked Node gate must still compare actual descriptors to the named files.
The old directory remains untouched;
only separately named future preparation namespaces may be created.

### Upstream filing decision

Nothing to file or draft.

- Upstream fault:
  none established;
  the caller contradicted documented operand grammar.
- Fixability:
  the fix belongs in the owned caller.
- Supported use case:
  the documented individual source/destination form passed.
- Contribution acceptance:
  not investigated because no upstream change is proposed.
- Maintainer willingness:
  not investigated because no upstream defect is claimed.
- Compatible upstream patch:
  unnecessary;
  no public issue or vendor contact follows.

## Installed pi-processes 0.12.0 write receipts are not consumer EOF evidence

### Symptom and deciding source

An owned orchestration asserted `EOFDelivered: true` after awaiting the write tool.
That assertion was withdrawn before the synthetic dependency run.
A tool receipt is not evidence that the child consumed all bytes or observed EOF.

Read-only source clone `pi-processes-write-source.nHfffTGG` is pinned at
`510e9bc6e5d01b42e8175c2b664295fe1645fec0`.
Its decisive files match installed source:
`extensions/processes/tools/write/index.ts` SHA-256
`cf1c0bf2f6b4158657521eae08ce578d40f03bed476e61fe1f2501a17d2a1d78`;
`src/manager/process-runtime-controller.ts` SHA-256
`ad66b76a9920c5a148ea5839eaa3b648fd5cc0c5a2fd473974f5c9979a5904aa`.

`src/manager/process-runtime-controller.ts:361` calls the stream synchronously:

```typescript
// pi-processes/src/manager/process-runtime-controller.ts
managed.stdin.write(data);
if (opts?.end) {
  managed.stdin.end();
  managed.stdinClosed = true;
}
return { ok: true };
```

`extensions/processes/tools/write/index.ts:49` reports the encoded input length,
not independently measured child consumption:

```typescript
// pi-processes/extensions/processes/tools/write/index.ts
bytes: Buffer.byteLength(input, "utf-8"),
end,
ok: true,
```

`extensions/processes/tools/write/index.ts:74` formats successful output as
`Wrote <bytes> bytes to "<name>" (<id>) and closed stdin.`
The failed variant at line 70 begins `Failed to write to stdin for`.
Neither formatter waits for the child's input parser.

### Verification and consumer boundary

Historical positive `proc_53ff` exited zero and saved a byte-identical 17,974-byte original record.
Historical negative `proc_1e6f` received empty input and exited one with
`SyntaxError: Unexpected end of JSON input`.
Their consumed namespaces remain preserved;
neither is replayed.

The new dependency caller compares and retains the installed tool's exact receipt.
It reports only queued-input length and end invocation.
Consumer admission still requires the child's complete saved original,
literal body equality,
applicable complete output checks,
and terminal zero.
The version-bound receipt comparison deliberately stops on changed or ambiguous formatting.
At that source-review epoch,
these caller checks were not a completed-runtime claim.
Later consumed `proc_f674` exited zero after retaining its exact 126,984-byte queued-input receipt.
The child's saved original matched the archived v4 strings byte for byte;
complete output/native outcome checks accepted 31 synthetic outcomes.
This establishes that finite consumer boundary,
not a stronger promise from the write receipt itself.
No SDK,
genuine original,
current permission,
grant,
or represented action was established.

Ignoring the receipt or treating fulfilled tool delivery as successful EOF does not establish that boundary.

### Upstream filing decision

Nothing to file or draft:
this was an owned overclaim,
not a demonstrated upstream defect.

- Upstream fault:
  not established.
- Fixability:
  correct the consumer assertion and admission checks.
- Supported use case:
  stdin writing is documented;
  child-consumption attestation was not established.
- Contribution acceptance:
  not investigated because no upstream change is proposed.
- Maintainer willingness:
  not investigated because no upstream defect is claimed.
- Compatible upstream patch:
  unnecessary for the owned correction.

## Owned empty stdin stopped Node 26.10.0 source-data admission

### Symptom and root cause

Consumed `proc_1e6f` exited one.
Node's `JSON.parse` emitted `SyntaxError: Unexpected end of JSON input` at
`contract/lifecycle/prospective-sdk-id-controls/prepare-reviewed-source-v2.mjs:45:34`
in the private prototype repository.
The caller sent zero stdin bytes and EOF instead of its retained original source record.
No SDK startup or manager construction occurred.

The data helper correctly rejected the missing input.
Changing its parser,
accepting empty input,
or reopening the consumed process would undermine admission rather than fix delivery.

### Verification and corrected boundary

Fresh `proc_53ff` used a separately named v3 helper and namespace.
One orchestration loaded the retained records,
verified their nonempty UTF-8 size,
started the managed process,
and sent all 17,974 bytes plus EOF to that returned process ID.
It exited zero with exact stdout/result projections and a byte-identical `0600` saved record.
Actual private stdout/stderr identity checks ran before record creation.
The original v2 helper,
diagnostics,
and failed namespace remain preserved.

The correction qualifies only this source-data transaction:
zero SDK imports,
zero helper imports,
and no human authority.
It does not qualify arbitrary stdin producers,
general process cleanup,
or an SDK invocation that has not run.

### Upstream filing decision

Nothing to file or draft.

- Upstream fault:
  no;
  the owned caller sent no document.
- Fixability:
  the correction belongs in orchestration.
- Supported use case:
  nonempty JSON passed in the fresh source-data transaction.
- Contribution acceptance:
  not investigated because no upstream change is proposed.
- Maintainer willingness:
  not investigated because no upstream defect is claimed.
- Compatible upstream patch:
  unnecessary;
  the parser's rejection remains required.

## Node 26.10.0 cleared-home parser import stopped the Pi 1.0.0 fixture

### Symptom and deciding source

`proc_7252` failed before SDK session construction.
Node's module resolver emitted `MODULE_NOT_FOUND`:
`Cannot find module 'yuku-parser'`.
The require base was inside the disposable fixture's
`controls-private/home/Monochromatic/package/git-policy/cli/package.json`,
which was not a repository dependency tree.

The owned loader selected its package base from `homedir()`:
private `contract/research/composed-literal-facts/load-parser.mjs:7-9`.

```javascript
// Private contract/research/composed-literal-facts/load-parser.mjs:7-9
const require = createRequire(join(homedir(), 'Monochromatic/package/git-policy/cli/package.json'));
export const parserPath = require.resolve('yuku-parser');
export const { parse } = await import(pathToFileURL(parserPath).href);
```

The new child-judgment constructor imported the source profile,
which reached that loader in a worker whose `HOME` had already been cleared.
This is an owned dependency-resolution assumption,
not an upstream SDK inability or a missing parser installation.

### Corrected source boundary and verification

The fresh v3 generator binds the parser entry before launching the cleared-home worker.
Private `contract/collector/native-program-sdk-copy-v3/stage.mjs:20-28`
emits an explicit module and relocates the profile,
collector,
and constructor imports.

```javascript
// Private contract/collector/native-program-sdk-copy-v3/stage.mjs:21, formatted across lines
save('parser',
  'export {parse} from ' + JSON.stringify(url(parserPath))
  + ';\nexport const parserPath=' + JSON.stringify(parserPath) + ';\n');
```

`proc_de32` staged 21 artifacts with no SDK imports.
`proc_5927` then passed two actual SDK sessions,
four injected requests,
and one canned original assessment per session.
The valid native literal program entered both children;
changed final child inputs entered neither.
The worker kept its cleared home,
private descriptors,
source checks,
and network tripwire.
No whole-home symlink or installed-source edit was used.

The consumed verification command was `mise --no-env --no-hooks run check`
in private `contract/collector/native-program-sdk-controls-v2/`.
Its retained manifest and result are the reproducibility record;
do not replay the consumed namespace unchanged.

### Separate generator failure and rejected approaches

`proc_d0d3` separately failed while parsing the owned v2 generator.
Node emitted `SyntaxError: Invalid regular expression`
with `Unterminated group` at `stage.mjs:19`.
An extra escaping layer corrupted the regex literal;
the generated parser module's newline spelling also needed correction.
No SDK import occurred.
Fresh v3 source corrected those syntax boundaries;
both failed namespaces remain unchanged.

Passing standalone parser tests under the real home was not evidence for a cleared-home SDK worker.
Changing `HOME` back,
exposing the whole repository through a home symlink,
or editing consumed evidence was not the adopted remedy.
Explicit source paths still depend on the pinned local dependency layout;
the result is a private host qualification,
not a portable production deployment.

### Upstream filing decision

Nothing is filed or drafted upstream.

- Fault:
  the owned loader and generator supplied the failing assumptions.
- Fixability:
  explicit staging passed the actual SDK consumer.
- Supported use:
  installed parser imports and the SDK's existing tool pipeline were exercised.
- Contribution policy:
  no upstream change is proposed.
- Maintainer disposition:
  no rejection or intent is inferred.
- Prototype:
  the correction lives in the owned staging boundary;
  no upstream patch is justified.

## Owned admission verifier confused extension callbacks with persisted results

### Symptom and source

The private Pi SDK 1.0.2 clause-reuse omission worker exited with status zero.
The separate verifier in `proc_60d2` failed Node's `assert.deepStrictEqual`:
actual `[]`,
expected `[true, true]`.
This was an owned verifier error,
not a new SDK failure or an absent tool outcome.

Paths in this section are relative to the private consumer-contract repository.
`contract/collector/instruction-meaning-reuse-omission/verify.mjs` checked the extension callback trace:

```js
// contract/collector/instruction-meaning-reuse-omission/verify.mjs
assert.deepEqual(record.trace.map(value=>value.isError),[true,true]);
```

The private dispatcher catches assessment failure before native execution.
In `contract/collector/instruction-meaning-sdk-copy/stage-private/prepared-dispatch.mjs:105`,
the deciding branch is:

```js
// contract/collector/instruction-meaning-sdk-copy/stage-private/prepared-dispatch.mjs
}catch(error){failures.push(error);block('Complete group preparation or assessment failed');return {block:true,reason:'Complete group preparation or assessment failed'};}
```

The staged agent loop separately creates and emits persisted tool-result messages
at `contract/collector/instruction-meaning-sdk-copy/stage-private/agent-loop.mjs:481`:

```js
// contract/collector/instruction-meaning-sdk-copy/stage-private/agent-loop.mjs
const message = createToolResultMessage(finalized);
await emitToolResultMessage(message, emit);
```

The callback trace was therefore the wrong evidence surface for this admission failure.
Do not infer absent outcomes from that empty trace.

### Verification and remedy

The intact `proc_0eb5` case executed both native reads and observed successful extension callbacks.
The omission replaced shared `instructionMeaningPairs` reuse with a fresh `WeakMap`.
It retained the exact intended assertion failure:
`AssertionError`,
code `ERR_ASSERTION`,
operator `throws`,
message `Missing expected exception.`
Neither native read executed.

The recovery task is `mise --no-env --no-hooks run check`
from `contract/collector/instruction-meaning-reuse-reconciliation/`.
It reads the retained worker exit,
source hashes,
assertion witness,
streams,
outcome,
and session JSONL.
It checks native result identities and error messages rather than manufacturing extension callbacks.
Read-only reconciliation `proc_cc9f` passed,
including both persisted error results and the exact omission witness.
It added no SDK sessions or provider calls.
This is not broader event qualification.
The failed verifier and original namespace remain unchanged.

Replaying the SDK worker to repair the verifier,
treating every exception as an omission witness,
or weakening native admission would not correct this evidence-boundary error.

### Upstream filing decision

Nothing is filed or drafted upstream.

- Fault:
  the owned verifier chose the wrong event surface.
- Fixability:
  the correction belongs in the owned result verifier.
- Supported use:
  this private staged admission profile does not establish a new upstream event contract.
- Contribution policy:
  no upstream contribution is proposed.
- Maintainer disposition:
  no upstream response or intent is inferred.
- Prototype:
  retained-artifact reconciliation tests the local remedy;
  no upstream patch is justified by this incident.
