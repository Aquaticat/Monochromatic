# Native host integration

This directory maintains the native runtime,
source collectors,
judgment consumer,
and Pi source transformations previously exercised in the private integration workspace.
The package extension entry remains unchanged while native delivery is completed.

`contract/source-provenance.json` records the original relative paths,
source repository revision,
and SHA-256 hashes before relocation.
Entries marked `previous-generated-input` are snapshots of earlier generated owned helpers.
They are build inputs here;
their original generators and historical results are not retroactively changed.
The `input` directories preserve those snapshots separately from newly generated Pi modules.
Imports were relocated to this package graph without changing policy decisions.

The maintained build emits the qualified Pi 1.2.0 source and owned transformations to `dist/native`.
The package `build` task builds maintained exports before building this native artifact.
`mise run //package/pi-plugin/auto-mode:build:native` builds that artifact;
`build:native:owned` rebuilds the owned transformations against an existing source emission.
Rebuilds replace the copied `dist/native/contract` tree so retired source modules cannot survive beside replacements.
The candidate CLI entry is `dist/native/cli.mjs`.
Its TypeScript bootstrap retains the original SDK session interfaces and forwards native owners unchanged.
The TypeScript host owner retains original session construction,
resource membership,
and disposal retry state.
Its static bridges preserve original generated constructor and reader identities.
The generated session dependency stays static through `native-host/session-disposal.mjs`;
awaiting its dynamic import during bootstrap prevented the native lifecycle module graph from settling.
Declaration companions describe the retained JavaScript owner interfaces without replacing their runtime checks.
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
supported selected meanings require a score of at least `0.99` and a unique lead.
Unknown and unsupported meanings remain unresolved even at `1`.
This operating cutoff carries no measured accuracy claim.
Original authority,
complete coverage,
and authorization checks remain independent.
The bootstrap binds the maintained direct HTTP sender for the incumbent Gateway route.
It reads `AUTO_MODE_LLMGATEWAY_API_KEY` only when an original configured assessment is dispatched,
retains the original encoded body and deadline,
and performs one HTTP request per client attempt.
Gateway-internal retries remain separate from client attempt accounting.
`test:assessment-transport` covers isolated and loopback HTTP behavior;
`test:native:assessment-transport` connects it to original native policy review with authored responses.
`test:semantic-operating-policy` checks the built policy's fixed scope and admission boundaries.
`test:native:semantic-operating-policy` exercises permission,
prohibition,
unspecified policy,
and abstention through original SDK requests and maintained HTTP transport using authored replies.
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
The context source supplies presentation capabilities only;
it grants no permission and supplies no authorization facts.
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
`test:native:progress-events` currently reproduces a delivery blocker:
an unchanged progress callback invalidates the approved program's source snapshot before any child executes.
Awaiting its completion alone does not fix that failure.
The receipt-timing proposal and measured contrasts are recorded in
`doc/planning/pi-auto-mode-governing-domain-closure.md` and `doc/troubleshooting/pi-sdk-staging.md`.
Complete lint verification,
installed host activation,
and genuine human approval remain outstanding.
Empirical semantic qualification is not established;
the adopted operating policy does not require another paid trial.

The dedicated `auto-mode-native` dependency catalog preserves the parser releases used by those fixtures.
It leaves the repository's other parser consumers on their existing catalog.
Named catalog syntax follows the [pnpm catalog documentation](https://pnpm.io/catalogs).
