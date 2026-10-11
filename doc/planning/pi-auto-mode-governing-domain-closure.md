# Auto-mode governing-domain closure

## Status and purpose

The user selected option A on 2026-10-09.
Account for all original host instruction inputs within their applicable scope.
Broader retained and persisted provenance work is authorized;
the domain consumer is not yet implemented.
The installed plugin remains unchanged.

The expanded-prompt origin implementation is complete in the private repository:
full native `proc_5d3b`,
action `proc_15a2`,
and final 12-document rendering `proc_0286` passed.
The next question is not whether those original inputs may be consumed.
It is what complete set of possible governing instructions the authorization engine must account for.

## Evidence and remaining boundary

The [accepted authority root](pi-auto-mode-instruction-authority-root.md) assigns source tier and scope
through trusted bootstrap registration.
It explicitly keeps complete source coverage and delegation separate.
The [batched assessment plan](pi-auto-mode-batched-assessment.md#proposed-expansion-of-request-source-accounting)
leaves broader persisted provenance and a new closed-world policy as separate proposals.

In private `contract/integration/action-policy/premises.mjs`,
`inspectPolicyPremises` always retains `request-source-domain`.
In `request-material.mjs`,
`retainRequestMaterialObligations` preserves it even after admitted whole-request `none`.
That estimate concerns selected content,
not the completeness of the governing domain.

Existing source associations establish original contributions to containing fields.
They do not establish complete composite origins.
Current capture covers active ancestry,
retained original run inputs,
and known inputs on the selected native path.
The bounded manager-load profile now includes user/custom text,
summaries,
and system prose,
including separate stored compaction companions.
Other loaded roles,
unsupported representations,
queued inputs,
and unobserved transformations remain incomplete.
The [current frontier](../handover/pi-auto-mode-current-frontier.md) records each consumer's verification boundary.
Original expanded text,
handler output,
and loaded inputs are unregistered;
transport roles do not assign authority.
Callable and schema dependency snapshots do not establish a tool-description instruction-source capability.

The current records therefore do not justify removing the domain premise.
Independent source/transcript review reached the same conclusion;
that review is not execution evidence.
Adding more partial associations cannot by itself resolve the missing domain boundary.

## Options

### A: Account for all original host instruction inputs

Define the domain as every original instruction-bearing input supplied by the concrete host
within the applicable scope,
plus material reached by valid delegation.
This includes independently governing inputs that were suppressed or not transmitted.
Registration still establishes authority only for its original source;
unregistered potentially governing instructions remain unresolved,
not silently excluded.

The accepted choice authorizes the next provenance work beyond active-run inputs,
including retained and persisted instruction inputs.
Code must demonstrate that the supported host profile accounts for its input-producing paths.
Unknown history,
unsupported transformations,
missing origins,
and unsupported delegation keep the profile unresolved.
No model or caller can certify that the collection is complete.

Benefit:
this preserves the current treatment of possibly governing but unregistered inputs.
A missed authority registration does not silently remove a possible restriction.
Cost:
existing active-run and containing-field evidence is insufficient;
additional original-owner integration and omission controls are required.

### B: Define this guard's roots as exactly the explicitly registered sources

Adopt an additional policy boundary:
only roots explicitly registered by trusted bootstrap,
and material they validly incorporate or delegate to,
can govern this guard.
Absence of registration would exclude independent root authority by policy,
not prove that the source has no authority outside this guard.

Code would still need to prove that the existing owners retain every root in that configured domain,
including non-transmitted roots,
and that delegated uses are properly bound.
Registration would not itself prove collection completeness.
No parallel registry or caller-supplied completeness flag would be introduced.

Benefit:
the governing root universe has an explicit configured boundary.
Cost:
forgetting to register an intended source changes what this guard enforces.
The currently unregistered expanded prompt would not independently govern under this option.
Every intended root would need explicit enrollment before relying on automatic approval.
This is a policy change,
not a deduction from the existing captures.

### C: Keep the verified private prototype unresolved at this boundary

Do not choose a domain-closure rule or expand persisted provenance now.
Retain the verified consumers and keep automatic policy resolution withheld.

Benefit:
no additional scope or trust assumption.
Cost:
this does not complete the migration's automatic-resolution path.
Further partial contribution accounting alone would not change that result.

## Concrete difference

Suppose a registered policy permits local reads,
and another original host input says not to read `secrets.txt`,
but that input has no established authority registration.

Under A,
that possible restriction remains an unresolved authority or source-domain obligation.
Under B,
it is not an independent governing root unless bootstrap registers it
or an existing root validly incorporates or delegates to it.
Under C,
the current domain hold remains in place.
These outcomes assume no separately established prohibition or other unresolved premise.

## Accepted recommendation and required verification

Ranking:
A > B > C.
A preserves the existing conservative treatment of unregistered instruction inputs,
whereas B changes that treatment and risks omissions in root configuration.
B at least defines a finite policy boundary for further implementation;
C deliberately leaves the automatic-resolution path incomplete.

Whichever implementation option is selected,
code must prove original occurrence membership,
applicable scope,
retention of non-transmitted governing inputs,
and supported delegation accounting through existing owners.
A missing root or required origin edge must keep the domain unresolved in a required-red test.
Interpretation,
external facts,
operation coverage,
and semantic admission remain separate premises.

The accepted exact same-source incorporation policy is unchanged.
Historical scope note:
the later user correction makes installation part of delivery;
see the current direction in `doc/handover/pi-auto-mode-current-frontier.md`.
The original option comparison did not independently authorize the following changes.
No option authorizes a second request parse,
request re-encoding,
a duplicate tools or message inventory,
a model completeness oracle,
new provider trials,
production qualification policy,
or installed activation.

## Input receipt boundary under review

The accepted all-host-input domain remains in force.
A separate meaning question surfaced during the implementation:
when does text written into live SDK state become an original instruction input?
This section proposes a clarification,
not a decision or a new source-authority policy.

The in-place array intake inserted an instruction into `session.agent.state.messages`,
then removed it before the next prompt.
The array identity and prior contents were restored;
no prompt/setter call or manager append received that instruction.
The native review completed unresolved before the test required retention of the erased text.
That proves the existing observers do not retain this transient write.
It does not independently prove that this write belongs to the accepted governing domain,
or that an unauthorized operation executed.
The required-retention assertion encoded the agent's interpretation of input receipt.

Installed core `createMutableAgentState` returns its live message array
and copies replacements through the `messages` setter.
The disposable interception probe found that method wrappers miss borrowed methods and direct writes;
a proxy on an array does not observe writes through an earlier raw alias or a borrowed nested object.
Those observations reject the tested implementations,
not every possible earlier observation mechanism.

### Receipt at host processing boundaries

Count original configuration arguments,
loaded entries,
API/setter arguments,
and extension/event inputs or outputs when the host receives them through their processing boundary.
A received instruction remains accounted for when later hidden,
transformed,
rejected,
or omitted from transmission.
Under this clarification,
direct live-state writes enter the domain when the host processes that state;
a write undone before that processing does not independently enter it.

Benefit:
this gives the consumer an explicit input contract
without treating every transient memory edit as a submitted instruction.
Cost:
it deliberately excludes undone direct writes even though the array belongs to the SDK.
That exclusion is a scope decision,
not something the absence of a capture proves.

### Receipt at every live-state write

Also count every insertion or mutation of exposed instruction-bearing state at write time,
even when the host never processes the value before it is erased.
The push/pop and direct-index intake cases then remain required retention failures.

Benefit:
this preserves that broad interpretation of the live state surface.
Cost:
it requires observation or enforceable ownership of those write paths,
including borrowed aliases,
while preserving the required native behavior.
The current collectors do not establish this proof.
A judgment-time snapshot cannot substitute for it.

Ranking:
processing-boundary receipt > every-write receipt,
because the former defines a concrete host input contract
while still retaining every originally received instruction.
This is a recommendation awaiting the user,
not permission to silently exclude a missing origin.
Both choices retain unregistered potentially governing inputs once received;
neither switches to registered-roots-only domain B.
Unknown domain membership does not become automatic approval,
denial,
or a new approval request.
