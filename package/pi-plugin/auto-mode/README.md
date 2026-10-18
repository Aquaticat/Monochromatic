# @monochromatic-dev/pi-plugin-auto-mode

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Automatic review of model-initiated Pi tool calls.
The installed native host evaluates the proposed operation against applicable instructions and authorization.
Luna estimates instruction meanings;
code resolves the decision and preserves the original operation through confirmation and execution.

The [architecture and size record](doc/architecture.md) documents the shared prepared-group implementation,
each major responsibility,
verified behavior,
and remaining lint debt.
The last reviewed cleanup measures about 22.9 MB including active output and a verified rollback,
excluding shared dependency symlink targets.
Later verification builds add retained artifacts;
this historical checkpoint is not a current deployment-closure measurement.

## Current native behavior

The installed `pi` command uses the maintained native host described in [the native README](native/README.md).
It uses `openai/gpt-6-luna-decisions` through the Gateway Decisions endpoint,
with the adopted `0.60` selected-option probability cutoff and a unique leading meaning.
This threshold is an operating rule,
not a measured accuracy guarantee.

Complete assessments are split into provider requests of at most 200 questions,
with up to three parallel calls per bundle and three sequential bundles per judgment.
Every call shares original cancellation and preparation-inclusive timing.
Fifteen seconds is an advisory performance target; elapsed time never expires review evidence.
No average USD 0.001 per judgment cost limit applies.
Question identities and complete shared context survive partitioning;
partial answer sets cannot authorize execution.

Assessment concerns execution permission and required consent.
Tool-use, formatting, naming, and workflow conventions remain agent guidance.
Review inputs contain the proposed operation, readable project policy excerpts,
and the larger of the latest five visible messages or the span from the latest user message.
Pi's hidden prompts, tool metadata, and skill catalog remain outside model review.
Assistant thinking and provider signatures are excluded from conversation and proposed-operation inputs.
Bash is parsed locally into command, argument, quoting, control-flow, redirect, and expansion structure.
The same projection covers process start commands.
Complete shell source stays local for execution and human confirmation.
Literal arguments and quoted here-document bodies remain data, including text resembling shell syntax.
Incomplete or unsupported parsed structure routes the original operation to human confirmation.
The [review input verification record](native/review-input-verification.md)
documents request-capture coverage and complete-session replay requirements.
Complete copies of the root policy in visible messages are replaced by a reference to selected excerpts.
Older conversation receipts stay local for provenance.
Each clause question includes the complete proposed operation beside the selected clause.

Initialization and reload consult the persistent rule-relevance cache and send only changed or missing
tagged rules, individually with heading context, to Luna.
Tagged root rules scoring below `0.60`, including uncertain rules, are excluded from operation review.
Complete `AGENTS.md` documents are never sent as policy context.
The original file and source spans remain local for freshness checks.
Relevance estimates grant no execution permission.
Startup classification failure preserves ordinary chat and routes tool calls to scoped confirmation;
without a UI, execution remains withheld.

Established permission allows the operation automatically.
An established governing prohibition blocks it.
An explicit fresh-confirmation requirement or uncertain clause assessment first reaches a whole-operation
decision-model review using selected policy excerpts, visible conversation, and prepared operations.
The same Luna model and `0.60` selected-probability cutoff apply.
Only unresolved or failed automatic paths open the original operation's dialog when a UI is available.
The dialog offers `Allow` and `Stop`.
`Allow` authorizes only that prepared group;
`Stop`,
dismissal,
and a legacy denial response abort the current run.
An unavailable approval channel leaves an uncertain operation blocked.

Manual confirmation cannot override an established prohibition at the strongest known applicable priority.
An unresolved prerequisite estimate is reconsidered by the decision model before manual review.
Last-resort Allow authorizes the original prepared group while retaining the original prerequisite diagnostics;
it does not assert that an external approval was obtained.
Original source,
operation,
authorization,
and cancellation checks remain active.
Recoverable clause-assessment failures try the decision model within the original cancellation lifetime and transport allowance.
Missing observation evidence, exhausted automatic review, and unresolved final decisions
fall back to manual approval of the complete prepared operation.
This fallback retains native operation identity, tool and argument checks, and cancellation.
It does not create automatic evidence or replace an established policy decision after its dependencies change.
Without a usable approval interface, execution remains withheld.
The local tagged logs correlate complete assessment inputs and replies with per-clause admission,
source references, errors, fallback choices, and the final verdict.
`test:native:decision-fallback` exercises these paths and verifies reconstructable diagnostic records.
Provider request metadata supplies context and is not independently subject to tool-call approval.

Provider switching, retries, navigation, reload, and ordinary chat remain owned by Pi.
Prompt and request capture failures are retained for tool review without rejecting the native chat request.
Each tool decision captures the current native branch;
navigation invalidates that decision without retiring later prompts.

Native Shift+Tab bypass executes supported native programs without semantic profile admission.
The fixed virtual-input guard, original execution ownership, cancellation, status, and audit entries remain active.
With bypass disabled, automatic review covers direct Bash calls and the inspected program profiles in the native README.

## Architecture and maintenance

The package has one installed native execution path.
The superseded extension pipeline and its package extension registration were removed on 2026-10-17.
[Architecture](doc/architecture.md) maps every major retained responsibility to its package-local justification,
callers, invariants, alternatives, and verification tasks.
The [retirement record](doc/retired-extension.md) explains removed behavior and retained native controls.
The [historical extension and migration snapshot](doc/historical-extension-and-migration.md)
preserves the previous README and its durable implementation history.

`src/index.ts` exposes maintained named exports for consumers and built-artifact tests.
`src/native-policy-api.ts` defines the native bridge interface.
The generated bridge and its declarations derive their exports from that entry.

Use package tasks through `mise run //package/pi-plugin/auto-mode:<task>`.
The `build` task builds maintained exports and the native host.
The `lint:types`, `lint:oxlint`, and native verification tasks cover the maintained package.
