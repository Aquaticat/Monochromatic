# Pi 0.87.1 nominal dependency inventory rejects the configured workspace graph

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
