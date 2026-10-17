# Native host integration

This directory maintains the native runtime,
source collectors,
judgment consumer,
and Pi source transformations previously exercised in the private integration workspace.
The package extension export remains available for legacy consumers.
The installed native host replaces its legacy extension declaration to avoid duplicate guards.

The [file-observation contract](file-observation.md)
documents synchronous policy snapshots,
descriptor cleanup,
and the scoped filesystem lint exceptions.
`test:native:dependency-facade` exercises the typed original dependency owner through its native bridge.
It verifies opaque handle ownership,
root and source identity,
ordered callback failures,
every file checkpoint,
and exact retained file bytes in disposable roots.
Live checks enforce original cancellation and clock validity;
retained checks preserve cancellation and freshness after decision completion.
Fifteen seconds is an advisory performance target, with no elapsed-time rejection.
Mechanical projections explicitly withhold instruction authority and human permission.
`test:native:program-queue` checks original recorder reuse,
private token and public label membership,
immediate queue-tail publication,
and normal or exceptional dispatch release.
An original rejected predecessor retains its exact failure and leaves its already published successor unresolved.
`test:native:group-completions` verifies that original native outcomes remain retained after delivery closes.
It checks every delivery state,
original value and failure identity,
listener detachment,
and failures inside result delivery or cleanup.
Closed or failed groups retain outcomes without being relabeled as successfully settled transport.
`test:native:group-failures` checks occurrence identity and order,
first-failure publication before rejection and cancellation,
already-recorded token propagation,
and signal caching after callback completion.
Reentrant cancellation records its inner observation before the outer observation reaches the cache.
A throwing rejection callback leaves the primary failure retained without publishing cancellation or that cache entry.
The internal `RecordedGroupFailureError` token retains the original caught value in its occurrence.
`test:native:group-lifetime` verifies retirement callback order,
incomplete-membership failure retention,
work capture at drain invocation,
and frozen retained snapshots.
Failures during listener detachment or incomplete-membership recording leave retirement unpublished.
A pending rejection callback failure occurs after closure,
so a later retirement call does not retry that callback or publish cancellation.
Snapshots retain original failure and native completion identities without claiming execution effects.
`test:native:group-current` verifies original failure,
closure,
and cancellation precedence around parent-currentness and reached-view callbacks.
Callback-published state is re-read after both callbacks.
Parent cancellation observation stops for closed transport or fully retained outcomes,
while partial outcomes and existing failures preserve the original cancellation callback.
`test:native:group-dispatch` verifies drainable work publication before callbacks,
complete original member association,
opaque callback failures,
and observation after transport closes.
Invalid returned arrays retain every enumerable completion,
including extra named properties while skipping holes and inherited positions.
These unassociated outcomes stay inspectable without acquiring a declared member association.
`test:native:group-collector` verifies original capability and frozen-view checks,
exact argument serialization,
out-of-order member arrival,
replay and reentry rejection,
listener identity,
and combined cancellation.
It checks cancellation during final currentness and listener installation,
plus retained native outcomes after transport cancellation.
Independent arrival consumers distinguish failure retention from pending rejection:
the latter remains required even when the retention callback does not reject delivery itself.
`test:native:program-runtime` verifies frozen source tools,
lazy group ownership,
canonical view identity,
parent and native cancellation checks,
and script-value conversion boundaries.
Ordinary conversion failures retain their original identity;
native value guards pass through the original judgment's retention callback.
Runtime retirement closes entry before visiting reached groups in live insertion order.
Draining awaits its captured group work,
then inspects the current reached map and preserves the earliest retained program guard.
Independent lifetime consumers cover callback failures,
partial retirement,
and frozen snapshots that retain child inspection identity.
`test:native:runner-binding` verifies original recorder reuse,
parent-derived call numbering,
complete slot admission,
and distinct unresolved result tickets.
Original native callback identity is captured once.
Native option getters run before member signal lookup;
enumerable symbols and primitive object-spread behavior remain intact.
Missing tool-name lookups reach the original judgment admission callback unchanged.
`test:native:runner-events` verifies original recorder publication,
native event payload identity,
text filtering and coercion,
usage truthiness and getter order,
and reverse-order member settlement.
Start and update callbacks await host event completion.
Completion records the result and usage before publishing its end event,
then resolves the original member ticket only after the host finishes that event.
Opaque callback failures stop later publication and retain their original identity.
`test:native:runner-execution` verifies complete native dispatcher inputs,
original host and judgment receivers,
prepared member publication,
and native slot association.
An existing parent queue owner prevents reacquisition.
Otherwise,
host scheduling or the first matching sequential tool definition selects a native queue turn.
Parent currentness and cancellation are checked after acquisition;
the acquired turn remains held through asynchronous dispatch and is released on normal or exceptional exit.
The original predecessor-rejection behavior retains an unresolved published successor.
Native member signals reach the existing judgment admission validator unchanged.
`test:native:runner-facade` verifies the original frozen tool snapshot,
prepared-source equality,
judgment opening,
native slot publication before execution,
and aggregate drainage.
Runtime drainage starts before the retained native-work snapshot is read.
Execution failures reject the original member tickets and remain retained across repeated drains.
Aggregate failure order preserves execution failures before runtime or settlement rejections,
including duplicate and nullish values.
A missing script-value slot now throws an explicit null-check error before judgment invocation.
The original facade passed an undefined slot to judgment;
the independent diagnostic fixture accepts it without establishing real judgment admission.
`test:native:input-seal` verifies prepared argument identity,
descriptor admission,
original proxy failures,
and the inclusive 10,000-container bound through both wide and deeply nested trees.
Sealing freezes a parent before validating its children and visits the last child first.
The original array check counts own keys;
a missing index offset by an extra enumerable property remains accepted.
These consumers preserve that behavior rather than introducing stricter array validation.
`test:native:prepared-schedule` verifies the inclusive 64-member limit,
unique nonempty identifiers,
independently cloned calls,
and original judgment and tool capability checks.
Cloning precedes execution-mode validation.
The group and call objects are frozen;
nested arguments remain unfrozen until prepared-input sealing.
Only the first matching tool definition determines context support and execution policy.
Every context capability is checked before reading serial policy.
An explicit sequential mode skips tool policy reads.
All execution capabilities remain uninvoked during scheduling.
Original sparse-array scheduling is retained when no tool lookup observes an array hole.
This admission behavior does not establish successful complete dispatch for sparse input.
`test:native:prepared-completion` verifies final admission presence,
retained lifecycle failure precedence,
and original native rejection causes.
Duplicate and nullish failures remain in their original order.
Execution errors retain the original complete native outcome array and selected decision.
Successful completion freezes its envelope and native value list,
while retaining the original decision and first assessment snapshot identities.
Without a snapshot,
each completion receives a fresh frozen empty member list.
Original getter ordering and opaque observation failures remain unchanged.
`test:native:prepared-executable` verifies original tool metadata snapshots,
context-owner identity,
native argument identity,
and execution-turn admission.
Serial members await their selected turn before currentness checks;
parallel members never look up a turn.
Turn failures propagate without entering the retained native-failure list.
Currentness failures enter that list before context-guard state is inspected.
Only original native guard instances close the shared group to later execution.
Ordinary native failures retain their original identity without being added to that list by the wrapper.
Retained execution remains callable after a caller replaces the wrapper's `execute` property.

`test:native:profile-call` verifies original direct-call admission,
callable membership,
source bounds,
and private argument-pattern ownership.
Escaped identifiers keep their original source text and decoded callable name.
Callsite and callee-span envelopes are frozen;
the borrowed pattern remains the exact original decoder result.
Validation preserves original property-read order and opaque thrown values.
Synthetic parser nodes retain the original fractional end-position admission;
this does not establish that the parser emits such positions.
The computed-member fixture `tools[tool]` isolates computed syntax rejection from property-kind rejection.

`test:native:profile-successors` verifies original native `Promise.all` and `Promise.allSettled` declarations.
Complete successor collections retain their inclusive 32-member limit,
original source spans,
ordered aliases,
and private pattern ownership.
Original producer and borrowed call-inspector results retain their exact identities.
The original binding name is read for each mapped member and again for final publication.
Declaration envelopes remain unfrozen until their original outer owner publishes them.
Synthetic syntax isolates each combinator guard and preserves original getter order,
opaque failures,
and sparse array mapping.
Sparse group members retain holes while the original combined site spread materializes them as `undefined`.
That synthetic observation does not establish complete native dispatch for sparse input.

`test:native:prepared-member` verifies original native preparation,
independent sealed input snapshots,
and complete-group admission.
Manifests follow declaration order even when readiness insertion order differs.
Native preparation and assessment are awaited;
currentness and preparation-release return values remain synchronous.
Original blocking preparation bypasses sealing and group assessment.
The first shared decision survives a later assessment settlement.
Assessment validation retains original getter ordering and repeated reads.
Preparation failures remain retained with their original identity and produce a fresh fallback block.
Entry-marker publication failures reject before retention begins.
Failures in the retention or blocking owner still reject the native member.

`test:native:prepared-lifecycle` verifies original native callback order,
borrowed SDK argument identity,
awaited preparation turns and notifications,
and synchronous release ownership.
An undeclared member rejects before lifecycle failure retention or turn disposal.
Preparation may release its turn before native completion;
repeated hooks and final disposal release that turn only once.
Missing native preparation blocks admission while preserving the native result and finish notification.
Failures caught during execution are retained before blocking and rethrowing.
Disposal failures remain outside that catch;
combined execution and disposal failures preserve the original `SuppressedError` identities.
Partial updates and preparation callbacks return their original values synchronously.
Native options retain the original explicit `onUpdate: undefined` property when updates are absent.

`test:native:pattern-decoder` verifies original finite data,
exact result bindings,
ordinary object properties,
and inclusive collection and nesting limits.
The decoder borrows the original private pattern owner and diagnostic constructor.
Child patterns reach that owner before their containing pattern;
array item lists,
object entry lists,
and entry records are frozen before the containing pattern is published.
The owner supplies every returned pattern by identity.
Already published children remain observed when a later child fails.
Literal metadata,
unary arguments,
and property keys preserve original getter ordering and repeated reads.
Original sparse synthetic arrays retain their holes;
parser-produced array holes remain rejected.
Nameless synthetic identifiers isolate defined-binding rejection from name mismatch.
Custom test owners do not grant membership in the production decoder's private ownership set.

Relevance-cache initialization and publication use asynchronous filesystem operations;
their refresh owner rechecks original policy identity and cancellation before publishing a view.

`contract/source-provenance.json` records the original relative paths,
source repository revision,
and SHA-256 hashes before relocation.
Entries marked `previous-generated-input` are snapshots of earlier generated owned helpers.
They are build inputs here;
their original generators and historical results are not retroactively changed.
The `input` directories hold maintained code separately from newly generated Pi modules.
The original hashes describe relocation provenance,
not current file contents.
The program runner,
prepared dispatcher,
and judgment constructor in `collector/program-rule-batch-sdk-copy-v2/input/`
now contain their integrated implementations directly.
The build exports them through bridges without patching their source bodies.
Imports were relocated to this package graph without changing policy decisions.

The maintained build emits qualified Pi 1.2.0 source and owned transformations into an immutable release directory.
The stable `dist/native` link selects the verified active release.
The package `build` task builds maintained exports before building this native artifact.
Native policy consumers use the release's copy of the dedicated `./native-policy` package export.
It shares policy implementations with the extension entry through common build chunks,
without importing the extension's SDK-dependent transcript code.
`test:native:direct-imports` starts each generated manager and SDK entry in a fresh process,
constructs an owned in-memory manager,
and compares every native policy export's identity with the extension entry.
`test:native:question-settlement` verifies complete answer admission before publication,
original failure retention,
bounded raw and model data,
and terminal discard on stale bindings or expired judgment budgets.
Missing raw diagnostics use an absent `raw` property;
the `failure` property retains the original caught value,
including `undefined` for a successful decode.
`test:native:question-selection` exercises the original public selection entry,
canonical claim and evidence identities,
ordinary dense membership,
declaration and batch limits,
the UTF-8 request bound,
reentry recovery,
and current versus retained diagnostic reads.
`test:native:judgment-lifecycle` combines the built selection and transport budget
to verify original batch ownership,
once-only assessment,
shared operation exclusion,
canonical evidence,
and permanent closure outcomes.
Assessment and retention failures remain ordered peers in an aggregate without a new `cause` property.
Successful closure retains original dependency and batch identities
while explicitly withholding policy authority and human permission.
`test:native:judgment-preparation` checks original source sealing,
receipt identity,
complete member publication,
retained failures,
and real budget cancellation or expiry before publication.
The preparation owner shares original member records with instruction and execution owners.
`test:native:judgment-inspection` checks ownership and currentness before live member access,
original prepared data and file arguments,
and retained frozen diagnostic snapshots after cancellation or closure failure.
Retained inspection preserves original callback failures and declaration order without asserting live eligibility.
`test:native:judgment-dependencies` verifies original request identity,
permanent first-failure retention,
prepared program currentness,
and live versus retained dependency release.
Binding segments authenticate dependencies before entering,
release cached internal freshness before external postchecks,
and retain paired failures in original order without an added `cause` property.
`test:native:judgment-sources` checks original native and legacy source handoff,
receipt authentication order,
collection and cancellation identity,
and inert publication.
Freshness and dependency callbacks retain original failures and publication timing:
capture returns the current collection after its callback,
while freshness assertion passes its original snapshot to the callback.
`test:native:judgment-api` exercises every original public method's invocation boundary.
Guarded calls retain original callback identity and argument count;
direct calls retain function identity and caller receivers.
Retained selection inspection resolves the current selection only when called.
The public surface remains frozen and preserves original property order.
`test:native:constructor` checks captured bootstrap inputs,
original observation order,
independent occurrence accounting,
cancellation,
and expiry reached during source handoff.
`test:native:publication` checks every public method against independently grouped original owners.
The typed constructor composes initial budget and source observations,
lazy preparation and execution owners,
and final frozen publication while keeping the stable native entry bridge.
`test:native:request` checks producer authentication before observer lookup,
original stream and response identities,
callback receivers,
receipt identity,
and failure recovery.
`test:native:membership-read` compares the built object-keyed lookup with native WeakMap results
for owned object/function handles,
foreign identities,
and primitive queries.
`mise run //package/pi-plugin/auto-mode:build:native` builds that artifact;
`build:native:owned` rebuilds the owned transformations against an existing source emission.
Each release contains a fresh contract tree and matching maintained policy bundle.
The build loads its actual CLI before replacing the active link.
Generation or loading failure preserves the previous command;
the first migration retains the former directory and restores it if publication fails.
Older release directories remain available to processes already using them.
`test:native:build-activation` verifies failed generation, failed CLI loading,
directory migration, and subsequent link replacement in a disposable installation.
The native CLI entry is `dist/native/cli.mjs`.
`native/command.ts` and `bin/pi` route the ordinary command to that maintained build.
The `install:native` task retains a private settings backup,
installs the user-local command,
removes only the legacy auto-mode declaration,
and verifies that all other settings remain unchanged.
`test:native:installation` exercises this transition and repeat installation in disposable homes;
it also rejects a foreign existing command without changing settings.
Its TypeScript bootstrap retains the original SDK session interfaces and forwards native owners unchanged.
The TypeScript host owner retains original session construction,
resource membership,
and disposal retry state.
Its static bridges preserve original generated constructor and reader identities.
The generated session dependency stays static through `native-host/session-disposal.mjs`;
awaiting its dynamic import during bootstrap prevented the native lifecycle module graph from settling.
Declaration companions describe the retained JavaScript owner interfaces without replacing their runtime checks.
The maintained session constructor is `native-batch/session-root.ts`,
renamed from `session-root.mjs` on 2026-10-14.
Its typed static bridge retains the original lifecycle owner.
The construction-scope owner is now `lifecycle/runtime-factory-scopes/scopes.ts`,
renamed from `scopes.mjs` on 2026-10-14,
and imported directly through its maintained types.
It captures original callbacks and manager inputs,
requires the SDK-specific result preparer,
and retains failed cleanup before another construction can begin.
`test:native:factory-scopes` exercises callback replacement,
exact-result publication,
disposal retry,
and synchronous reentrancy against the built artifact.
`session-root-result.ts` copies each original SDK data descriptor once,
preserves optional fallback-field presence,
and freezes only the returned outer record.
`test:native:session-result` exercises this copied artifact with original data,
missing fields,
accessors,
and descriptor-observation controls.
It routes native manager selection,
services,
session construction,
replacement,
and disposal through the original owners.
Resource reload retains its original project-trust resolver and refreshes the policy capture.
The maintained resource registration and reload boundary is `native-host/resource-reload.ts`.
Both generated services and session reload use its named loader/options input.
Registered resources retain the original policy reload;
standalone SDK loaders retain their own reload method.
`test:native:resource-reload` checks original receiver,
argument,
result,
registration,
and failure identity against the copied native artifact.

The current CLI bootstrap designates the working directory's `AGENTS.md` with user authority.
Its semantic admission uses the
[adopted operating policy](../../../../doc/decision/pi-auto-mode-semantic-admission.md):
supported selected meanings require a score of at least `0.60` and a unique lead.
Unknown and unsupported meanings remain unresolved even at `1`.
This operating cutoff carries no measured accuracy claim.
Original authority,
tool-operation premises,
and authorization checks remain independent.
The outbound provider request supplies context;
its fields do not create an independent whole-request approval obligation.
The bootstrap binds the maintained Luna adapter and direct HTTP sender
for `openai/gpt-6-luna-decisions` through the Gateway `/v1/decisions` route.
It reads `AUTO_MODE_LLMGATEWAY_API_KEY` only when an original configured assessment is dispatched,
preserves every original state value and named question in the Decisions wire format,
retains original cancellation and advisory timing,
and partitions complete assessments into requests containing at most 200 questions.
One judgment permits at most three sequential bundles with at most three parallel HTTP calls each.
Every bundle uses original cancellation and preparation-inclusive timing without a deadline timer.
Failed bundles consume their allowance;
later dispatches and the single eligible retry share the same counters.
Each request retains complete shared context and original question names.
The policy consumer receives a merged answer set only after every partition passes attribution checks.
The average USD 0.001 per judgment cost target was removed on 2026-10-15.
Gateway-internal retries remain separate from client attempt accounting.
Categorical probabilities and independent confidence metadata remain unchanged.
Refusals,
missing or reordered answers,
wrong serving identities,
and invalid distributions fail without admitting partial estimates.
The single-request encoder rejects more than 200 questions;
the composed sender partitions larger assessments without dropping questions.
`test:assessment-bundles` verifies concurrency, exact answer membership, cancellation,
bundle ceilings, retry accounting, and retired capability rejection.
`test:decision-wire` checks conversion and the composed sender against authored fixtures.
`test:assessment-transport` covers isolated and loopback HTTP behavior;
`test:native:assessment-transport` connects it to original native policy review with authored responses.
`test:semantic-operating-policy` checks the built policy's fixed scope and admission boundaries.
`test:native:semantic-operating-policy` exercises permission,
prohibition,
unspecified policy,
and abstention through original SDK requests and maintained HTTP transport using authored replies.
The typed `action-policy/semantic-policy.ts` forwards original configuration and scope inputs
to the maintained consumer without replacing its validation.
Both the wire and native scope selector import their fixed serving model from `action-policy/assessment-model.ts`.
`test:native:unconfigured-policy` verifies unresolved native review without assessment or execution
when every semantic consumer is absent.
Bootstrap construction makes no provider calls.
The native lifecycle fixtures exercise actual CLI manager selection,
services,
reload,
cancelled replacement,
new session,
in-memory fork,
persisted resume,
and disposal retry without external provider requests.
The separate-process RPC fixture starts `dist/native/cli.mjs`,
checks the selected Qwen model and idle state,
and requires shutdown without stderr output.
Its fixture fetch blocker loads Pi's HTTP dispatcher before overriding fetch,
so native initialization preserves the deliberate override.
`test:native:process-network` checks initial setup,
reconfiguration,
fetch rejection,
and refusal outside the fixture child.
`test:native:manager-constructors` exercises every native constructor entry point.
It checks persisted conversation retention,
explicit session IDs,
working-directory overrides,
recent-session fallback,
and cross-directory forks through actual SDK session construction.
The built-in Codemode registration retains the original owned definition.
Native approval presentation now captures Pi's current extension context and original verdict API
for each original review.
`test:native:approval-context` passes Allow,
Deny,
Stop,
cancellation during selection,
and approval after reload with fixture UI responses.
The context source supplies presentation capabilities only.
The pending original channel supplies code-owned facts for an admitted `fresh-session-approval` clause;
those facts remain unsatisfied until the original user response arrives.
Generic prerequisites retain their separate fact owner.

Unresolved and unspecified clause assessments first reach the whole-operation Luna decision question.
It retains the original operation, selected conversation, policy, cancellation, and transport allowance.
Only unresolved or failed automatic paths reach the original dialog when a UI is available.
An established prohibition at the strongest known applicable tier blocks even when other premises are uncertain.
Headless uncertainty remains blocked.
The dialog offers `Allow` and `Stop`;
every non-Allow selection,
including dismissal and a legacy denial value,
aborts the current run.
Source freshness,
exact prepared-group identity,
and cancellation remain checked during and after approval.
Recoverable initial transport or assessment failures also try whole-operation review first.
Exhausted automatic review, uncertain final decisions, and unavailable observation evidence
fall back to manual approval of the complete prepared operation.
The independent manual group owns its original native signal, branch, prepared members, and execution tokens.
It does not fabricate an automatic assessment receipt.
An already established policy decision or approval cannot be replaced after its dependencies change.
A policy change during whole-operation review invalidates that operation instead of opening another dialog.
Decision logs retain source spans, distributions, admission results, fallback errors, and final outcomes.
Assessment logs retain the complete selected inputs and replies under a shared operation digest.
`test:native:decision-fallback` verifies final approval and denial, model failures, cancellation,
source changes, and reconstruction of the falsely admitted prerequisite from logger records.
Primary prompt and request observation stays passive when capture fails;
Pi retains its callbacks, errors, retry settings, and transport.
`test:native:session-actions` exercises native navigation and provider lifecycle behavior.
`test:native:host-isolation` exercises passive capture and manual fallback.
`test:native:manual-group` checks exact manual operation identity and execution lifetime.
`test:native:manual-review` covers uncertainty,
prohibition precedence,
confirmation outcomes,
and unavailable UI.
`test:confirmation` checks the built selector and abort behavior.
The package's TypeScript source set explicitly includes `native/**/*.ts`.
The build helpers,
module resolver,
dependency paths,
native manager constructor owner,
native host source preparation,
Agent,
resource,
program,
Session,
and main preparation phases,
import rewriter,
staged import identity checks,
native manager and dependency error contracts,
and Markdown adapter now pass their scoped type and lint checks.
`test:native:build-imports` exercises the built rewriter with escaped and adversarial module names.
`test:native:parser` checks the installed parser and disposable package variants;
it retains version,
module-resolution,
root-shape,
and original-coordinate rejection controls.
Separate disposable omission checks demonstrate that the corresponding guard assertions fail when each guard is removed.
The typed state,
tool-registration,
and message source generators preserve their original generated bytes.
Typed judgment preparation and the generated prompt handler module also preserve their original bytes.
The generated prompt Session preserves an original comment that the former regular expression rewrote.
The program Session retains the original private runner field spelling after adding its private marker;
the other generated program modules retain their prior bytes.
`test:native:state-assignments`,
`test:native:literal-rules`,
`test:native:members`,
and `test:native:program-value` exercise their parsed executable source boundaries.
Import,
literal-rule,
and private-member replacements share ordered parser-owned source spans.
The owned JavaScript runtime still needs type and lint completion.
Private destination names are checked against the consuming JavaScript grammar before source edits are assembled.
Result conversion extraction retains the original helper dependency order and rejects changed declaration membership.
The native return consumer now has typed slot,
invocation,
conversion,
and live-access contracts.
It captures conversion in the original native settlement continuation,
retains completed results after parent retirement,
and separately guards script-value access by current ownership and prepared-member completion.
`test:native:return` exercises the generated JavaScript consumer,
including copied returns,
synchronous reentry,
UTF-8 bounds,
ordinary conversion failures,
and later queued result mutation.
Native staging erases TypeScript annotations before generating JavaScript
and selects imports through parsed named declarations while retaining original-file checks.
`test:native:staged-import` covers formatted and escaped imports,
comment and string decoys,
replacement encoding,
duplicate declarations,
separate URL identities,
and foreign files.
Disposable omissions establish the sensitivity of both sets of guard assertions.
Native `context` and `context_with_system` callbacks now retain original inputs,
settled input mutations,
and complete defined return values through the existing manager source pool.
The synchronous observer preserves Pi's original await sites and handler-error reporting.
Its terminal receipt must belong to the original published run before source-domain accounting accepts these callbacks.
`test:native:context-receipts` exercises actual SDK permission,
prohibition,
unspecified,
potential request instruction,
throwing callback,
and unobserved-event cases.
Later queued return mutation cannot replace the value captured at native settlement.
The observer's traversal,
capture,
error-propagation,
and inherited bound checks have passing original controls and failing disposable omissions.
Other unobserved native events remain explicit source-domain gaps.
`test:native:event-receipts` exercises the original generic,
boundary,
message,
tool result,
tool call,
and user Bash dispatch methods.
It retains complete callback inputs,
defined results,
and settled mutations in bounded source chunks.
Native error identity,
overlapping callbacks,
empty dispatch,
capture failure,
and the existing source bounds are covered.
`test:native:progress-events` passes through native progress callbacks with one assessment and three child calls.
The approved operation retains its assessed source collection;
later inputs are captured for the next decision.
`test:native:next-decision-receipts` retains a later callback input and result,
then blocks the next operation after assessing those new sources.
`test:native:approved-dependencies` checks selected policy changes,
cancellation,
and immutable assessed arguments during approved execution.
The adopted receipt timing and measured contrasts are recorded in
`doc/planning/pi-auto-mode-governing-domain-closure.md` and `doc/troubleshooting/pi-sdk-staging.md`.
On 2026-10-15 the user approved removal of arbitrary instruction-capture capacities,
superseding the combined/session limit of 128 and resource limit of 64.
Byte accounting remains available without rejecting normal inputs at fixture-derived thresholds.
Ownership,
freshness,
descriptor checks,
and explicit cycle rejection remain required.
The isolated consumer with all 22 configured extensions passes through three child calls and cleanup.
Its assessment uses authored replies and makes no provider requests.
The installed Hyper primary,
live Luna assessment,
and genuine Allow for the original disposable read are verified in the
[current migration handover](../../../../doc/handover/pi-auto-mode-current-frontier.md).
Maintained native lint completion remains outstanding.
Empirical semantic qualification is not established;
the adopted operating policy does not require another paid trial.

The dedicated `auto-mode-native` dependency catalog preserves the parser releases used by those fixtures.
It leaves the repository's other parser consumers on their existing catalog.
Named catalog syntax follows the [pnpm catalog documentation](https://pnpm.io/catalogs).

## Inspected single-call programs

The user adopted literal single-call support on 2026-10-14.
The decoder accepts `return await tools.name({...})`
and `const result = await tools.name({...}); return result;`.
The existing awaited producer followed by `Promise.all` or `Promise.allSettled` remains supported.
The semantic scope `native-inspected-programs-v2` includes direct native Bash commands,
single-call programs,
and producer/successor programs.
Direct Bash commands retain their complete string and prepared-operation identity for automatic review.
`test:native:direct-bash` covers permitted, prohibited, uncertain, and mixed groups through native execution.
Its supported-meaning cutoff is `0.60` with a unique leading score under the adopted Luna policy.

Registered tool schemas have no aggregate property-count ceiling.
`test:native:tool-schema-capacity` retains 12,000 properties and rejects changed descriptors,
accessors,
and unexpected prototypes.
Retained-message binding indexes origins once by source identity and brackets construction with parent checks.
`test:native:run-message-freshness` verifies the read bound and rejects mutation during construction.

`test:native:single-call` verifies complete original source,
escaped identifiers and literal data,
rejection of copied declarations and unsupported execution,
both native single-call results,
and prohibition with no child execution.
The original reached-group owner enforces argument,
result,
dependency,
and cancellation checks for the sole call.
Native loadout descriptions show the supported forms and retain the underlying tool declarations.

## Original prepared-program lookup

The original native judgment method `preparedProgramFor` returns its retained inspection view,
or `undefined` before inspection is bound.
`native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-api.ts`
mirrors that existing callable contract in `PreparedProgramLookup`.
Changing absence to a symbol,
throwing,
or returning a wrapper would change the native consumer boundary during the typed-owner port.
Optional private fields still use ordinary optional-property syntax.

The scoped `no-restricted-syntax/no-nullish-union` suppression covers only that return-value alias.
The deciding implementation is
`package/oxlint-plugin/no-restricted-syntax/src/rule/no-nullish-union.ts`,
which rejects nullish union members without contextual options.
Its `simpleBanRule` helper in `src/rule/_simple-ban-rule.ts` exposes no configuration or allow-list.
The rule's own documented external-API mirror exception fits this retained native method contract.
Deriving a nullable result from an unrelated `Map.get` signature would obscure the actual contract;
the explicit alias records the native method's real absence value.
