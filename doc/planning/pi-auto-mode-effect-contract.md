# Auto-mode effect and authorization contract

## Status and scope

This is a contract inventory for the private qualification phase confirmed in Q22,
not a qualified production policy or an adopted implementation.
It extends the [axiom design](pi-auto-mode-axioms.md)
beyond the private protected-read,
protected-transfer,
and cache-removal demonstration.
The accepted interview choices in that design remain authoritative.
Q13 B permits qualified semantic effect estimates to support approval for validated inspected script forms,
without separate code-established effect analysis.
The stricter code-admitted-operation-family alternative was not selected.
Q22 confirms proceeding with private contract and real-consumer qualification.
It does not select a production profile or cutoff,
qualify the governing-instruction path,
or authorize changing production.
No production files are changed by this investigation.

The migration replaces the existing reviewed-action path,
not every tool's execution semantics.
Do not silently expand guard coverage or describe existing unflagged tools as newly verified safe.
Additional unsupported reviewed actions may require manual approval,
as already accepted by the user.

## Policy epoch admission

The current policy hash is
`2f4377aa7b950d178999a88337bfd7ec1dba1723313d1650d712e06b2dc3a7cc`.
The previous `4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`
studies and structural index cannot be admitted as current-policy evidence.
Preserve them and capture the full new policy separately under task #76.
A changed on-disk policy is not proof that an already-running harness refreshed its loaded instructions.
The collector must keep those source versions and observations distinct.
See the [freshness checkpoint](../handover/pi-auto-mode-axiom-evaluation.md#policy-freshness-checkpoint).

## Measured SDK collection constraints

A bounded actual Pi `0.87.1` SDK phase passed baseline,
later-handler,
request-local,
and forced-projection cases under the current policy snapshot.
It used disposable sessions,
a scripted provider,
and an inert tool,
not real model calls or user approvals.
The [SDK observations](../troubleshooting/pi-instruction-snapshots.md#actual-sdk-session-observations)
retain raw-result bindings and limits.

The tool-time getter sees the tested later run contribution,
but misses request-local edits visible to the provider.
Forced projection can remove markers from rendered views without changing the resource-owner inventory.
Inline instruction sources can lack a filesystem path.
Accordingly,
collection must preserve source inventory,
observed stage,
and content version separately.
Neither rendered text nor a path authenticates a governing source.

The tested SDK construction owner had access to `ResourceLoader`.
This does not establish that the ordinary production extension context exposes that owner,
or that the known fixture inventory covers all real producers.
The private review interface and real-adapter admission tests remain task #16.

## Current dispatcher and evidence limits

`package/pi-plugin/auto-mode/src/index.ts` checks the fixed virtual-input guard first,
then explicit bypass,
then static signals and relevant follow-ups after a denial.
It returns without judging when that final flag is false.
The fixed block remains active during bypass.

`src/signals.ts` returns booleans indicating review is needed.
A signal is not itself proof that a dangerous effect occurs.
For example,
`src/constants.ts` flags the words `auto-mode` and `safeguard`,
secret-shaped names,
inline interpreters,
and selected command/option combinations.
A documentation example can trigger a signal without attempting its described operation.

`src/tool-helpers.ts` extracts body text from built-in writes and edit replacements,
and paths from selected built-in tools.
Its `isRelevantTool` uses the finite built-in list in `src/constants.ts`.
Do not extrapolate these checks to every custom or MCP tool.
No broad new tool coverage is included in the current migration scope.

`src/system-prompt.ts` currently asks a general judge to approve routine development,
deny dangerous behavior,
and ask on uncertainty or suspected circumvention.
It does not enumerate a complete effect calculus.
Its blanket exclusion of project context from action authorization is superseded by Q21 at the design level.
Legitimate governing project instructions must be followed by authority,
priority,
and scope;
arbitrary payload or output text still cannot promote itself into an instruction source.
This is not a production edit to that incumbent prompt.
Consequently,
a new finite policy cannot claim semantic parity merely because it returns the same action labels on examples.
Every retired behavior needs a new rule owner or an explicit manual-review disposition.

## Parser facts precede model questions

The user's parser-boundary correction supersedes any reading of this inventory
that delegates Bash syntax interpretation to a model.
`src/command-parser.ts` delegates to
`package/agent-harness-shared/shell-command-analyzer/src/analyzer.ts`.
The shared analyzer retains commands,
argument source spellings,
redirect read/write kinds,
expansion flags,
and function-definition versus immediate-control-flow context.
`src/visit-word.ts` traverses double-quoted expansions rather than single-quoted literal contents.

An actual call through the auto-mode wrapper on the frozen quoting pair
returned no substitution and no `cat` command for the literal case,
and substitution plus `cat /work/project/.env` for the expanded case.
The private parser-only probe is
`~/temp/agent/auto-mode-parser-boundary-2026-09-26/probe.mjs`.
Neither command was executed.
The existing shared-analyzer test `src/index.unit.test.ts:89`
already covers the quotation rule with `date`.

Do not use `allFiles` as proof of reads:
the literal fixture contributes a path-shaped printed string there.
Nor does `executedCommands` prove runtime reachability or successful access in arbitrary control flow.
Keep each fact's scope,
source,
and unresolved dependencies explicit.
Parser facts and supported command semantics are code-owned inputs to policy,
not occurrence questions delegated back to a model.

The next candidate tranche is limited to remaining narrow natural-language relations
against explicit supplied facts,
without raw Bash interpretation or a model-produced final action.
This limited tranche does not replace Q13 B:
qualified semantic-effect estimates for validated inspected forms remain eligible where code has not established the effect.
Unsupported evidence is not converted into a false occurrence claim.

## Assessment snapshot

The evidence-collection module must produce an owned immutable snapshot before inference.
Its proposed fields are:

- Exact tool-call identity and complete current input,
  with the intended execution stage.
- Canonical working directory and resolved targets where code establishes them.
- Complete freshly read policy bytes and digest.
- The other active governing instructions,
  with source identities,
  code-established authority and priority,
  scope,
  and applicability evidence.
- Loaded contextual evidence needed by the applicable rule.
- Active session branch and originating human-request witness.
- Active human-approved grants,
  each with its own identity,
  original wording,
  confirmed structured scope when available,
  conditions,
  lifetime,
  and revocation state.
- Previous blocked effects relevant to recurrence,
  not merely the previous action's broad goal.
- Profile-applicability facts and explicit unresolved fields.
  Applicability is not a hidden requirement to prove the script's effects in code.
- Axiom-definition,
  adapter,
  model/runtime,
  and policy-profile versions.
- One total assessment deadline and caller cancellation signal.

A parsed filename,
`user` message role,
assistant assertion,
or model-generated relation is not interchangeable with a trusted witness.
Missing evidence remains missing rather than being encoded as probability zero.

### Instruction authority, observed views, and coverage are separate

The [Pi instruction-view probe](../troubleshooting/pi-instruction-snapshots.md)
measured differences between an early context-file copy,
run options,
the current prompt getter,
request-local system messages,
and a synthetic provider payload.
It used inspected source methods under Node `v24.21.0`,
not the actual host or an authenticated input producer.
Do not turn those observations into a production collector qualification.

The private consumer contract must distinguish:

- An instruction source and its code-established authority,
  priority,
  scope,
  version,
  and any legitimate delegation.
  A raw role or filename cannot construct that authority.
- An observed representation,
  including its composition stage,
  owned bytes or structured content,
  digest,
  and source links.
  Seeing text at a stage does not establish its authority or prove later stages are covered.
- Coverage evidence for the admitted producer inventory and current action.
  An unaccounted instruction producer,
  unresolved delegation,
  collector error,
  or opaque transformation cannot become a claim that no relevant instruction exists.
  A caller-supplied completeness Boolean is not proof.

A governing instruction can legitimately delegate scoped instructions to another source.
That is different from a payload promoting itself into authority.
Keep the delegating instruction,
referred source identity,
and scope restrictions linked in code.
The existing request/prose studies do not qualify those additional relations.

The review module should own collection and finalization behind its review interface,
rather than making callers assemble purportedly trusted facts.
The real host and disposable test adapters must exercise that same interface.
Source-method observations are preliminary evidence for designing it,
not a substitute for the later consumer tests.

## Fact and axiom inventory

### Filesystem target and access

Current sources:
`src/path-signals.ts`,
`src/signals.ts`,
and the read-only proof and allowlist helpers consumed there.

Code owns lexical/canonical resolution,
containment,
symlink handling,
existing-target checks,
secret-name signals,
read-versus-write tool identity,
and allowlist eligibility.
The existing lexical fallback for unresolved targets is not a successful canonicalization proof.
Model estimates must not certify filesystem facts that were not observed.

Semantic questions may concern whether a trusted request names this operation or resource.
A qualified remaining semantic-effect question may concern inspected executable content under Q13 B,
not syntax facts already established by the parser.
Bash quotation and substitution contrasts belong first in parser/fact-derivation controls,
not model-quality comparisons.
When a rule requires an observed canonical target,
unresolved target identity is missing evidence.
Other qualified rules may use narrow semantic effect and scope estimates under Q13 B.
An unsupported input still cannot approve merely because listed access axioms are false.

### Protected values and environment access

Current sources:
`src/content-signals.ts`,
secret-path and variable patterns in `src/constants.ts`,
and the environment/credential checks in `src/signals.ts`.

Code owns detected patterns,
known argument positions,
and explicit environment-dump operations.
A secret-looking path is a protection signal,
not proof of the file's contents.
The semantic claim must distinguish reading a value,
listing a name,
printing example text,
and intentionally exposing that value.

The user has now explicitly authorized all task-relevant assessment content through LLM Gateway/Jev,
including private or sensitive content.
That input permission is established by the human,
not by a model estimating whether its own request may be sent.
Do not extend it to another assessment provider or an unrelated tool action.
Do not read or export additional credentials merely because the permitted input scope is broad.
Collect only the evidence needed for the scoped assessment.
Missing or unqualified evidence still requires the appropriate local/manual handling.
Complete current `AGENTS.md` is never silently redacted or shortened to make a request eligible.

### Outbound transfer and legitimate credential use

Current sources:
network command detection,
secret parameter references,
sensitive pipeline sources,
and trusted temporary-helper credential handoffs in `src/signals.ts`.

Keep source,
destination,
operation,
and transfer channel linked to one proposed effect.
A read plus an unrelated network request does not establish a data flow.
A credential intentionally used for authentication to its intended service is not automatically the same effect
as putting that credential into an unrelated upload body.
The request must satisfy its own admitted operation and destination scope.

Code owns parsed endpoints and data links where its analyzer can prove them.
A model may estimate a narrow remaining relation in admitted content,
but may not invent an endpoint,
claim ownership of it,
or turn a missing link into evidence of absence.
Nested or dynamic flow outside the qualified script forms requires review.
Within a qualified form,
Q13 B permits the model to estimate the specified flow relation without separate code proof.

### Filesystem mutation and privilege changes

Current sources:
mutating commands,
recursive/force flags,
root-target detection,
`chmod`,
`dd`,
`mkfs`,
and privilege-command checks in `src/signals.ts` and `src/constants.ts`.

Separate create,
overwrite,
truncate,
remove,
permission change,
owner change,
and privilege escalation.
Code owns numeric mode interpretation and concrete target identity when available.
Models should not calculate permission bits or infer a missing prior mode.
A reference to a destructive command in a fixture is not execution of that command.

The three-effect prototype's `cache_removal` rule is not a production policy for every filesystem mutation.
Current request scope,
explicit prohibitions,
active grants,
fixed guards,
and uncertainty must be composed by code.
A qualified inspected script may be approved using model-estimated effects under Q13 B.
Qualification must cover effect detection and catalog omissions;
a low probability on an arbitrary incomplete checklist is not qualification.

### Introduced executable behavior

Current sources:
write/edit body extraction and content/text signals.

Distinguish executable changes from prose,
fixtures,
quoted snippets,
and inert data.
Where an edit is admitted for semantic assessment,
name the particular introduced behavior being tested,
its target,
and its execution stage.
Do not ask the model whether the patch is safe,
malicious,
or generally acceptable.

A negative answer about one introduced behavior does not establish that all other behaviors are absent.
Approval requires the applicable qualified profile and its evidence and estimate conditions,
not separate code-established effect analysis.
Otherwise request human review.
This is especially important for arbitrary scripts,
package lifecycle commands,
and code that loads more executable content.
No new universal program analyzer is assumed or authorized.

### Denied-effect recurrence

Current sources:
turn-level denial state in `src/index.ts`
and the recurrence examples in `src/system-prompt.ts`.

The model question should concern whether the new proposed operation attempts the same named blocked effect
on the relevant resource,
not whether it pursues the same user goal.
A harmless alternative may serve that goal without repeating the effect.
Code owns the previous block record,
its scope,
and the decision to ask when recurrence is unresolved.
Batch siblings and previous denials remain evidence,
not new grants.

### Policy and guard changes

Current sources:
text signals for guard-related names,
fixed virtual-input policy,
and project-context handling.

Separate editing documentation that mentions the guard from changing code or configuration that affects enforcement.
Source role and execution stage matter.
A request or grant can cover legitimate guard development,
but cannot disable a fixed block by appearing inside the candidate patch or its comments.
The canonical current policy remains external to the submitted action.

## Authorization matching

### Governing instructions before permission-source shortcuts

Q21 requires following applicable `AGENTS.md` rules and any other governing instructions.
A direct human request or stored grant is not the only possible authority for an action.
An instruction may permit the action,
prohibit it,
or require approval when its conditions hold.
Apply actual instruction priority and scope in code;
do not ask the model to pick a winning instruction or an overall action.

Code establishes source authority and supplies applicability facts it can determine.
Remaining narrow instruction-to-action relations require their own qualified semantic estimates.
Human-grant provenance remains required on human-grant paths;
a policy permission does not manufacture such a record.
A source named `AGENTS.md`,
a copied role label,
a proposed patch,
or an instruction quoted inside a payload does not establish authority by itself.

A complete source inventory and applicability handling are required before treating a case as instruction-free.
Unknown applicability is not established absence.
If no relevant instruction applies,
Q21 leaves the outcome unspecified rather than selecting the prototype's blanket transfer denial
or the proposed immediate prompt.
Other applicable safeguards still govern.
The existing request/prose studies do not qualify this governing-instruction path.

### Deterministic authority, semantic scope

Human acceptance creates the grant.
Axiom probabilities may assess only whether a named operation,
resource,
destination,
or condition matches that already accepted grant.
A model cannot manufacture authority from plausible wording.

For each possible authorization witness,
keep all required scope dimensions tied to the same permission relation,
not merely the same parent grant identity.
A grant saying `read package.json and overwrite README.md`
does not state permission to overwrite `package.json`.
Operation and filename mentions can both be present without being linked that way.
An independent contract review confirmed this cross-clause counterexample.

Human-confirmed structured grants supply explicit scope identities.
For qualified legacy prose,
use a narrow joint text-relation estimate about the named operation/resource/destination tuple,
not an AND of unrelated mentions.
This estimates what the directive states,
not whether the proposed action should be allowed overall.
Any applicable exclusion and required condition must remain attached to that same permission relation.
Unknown binding or unresolved restrictions cannot support automatic approval on that witness.

Do not combine dimensions from different grants or different scopes inside one grant.
Fully satisfied independent witnesses can be alternatives.
Code owns the actual grant provenance,
condition evaluation,
precedence,
thresholds,
and final result.
No model-generated clause text or newly invented scope ID is required.

A directive may also state a prohibition that is broader than one permission witness.
For example,
`Allow reading .env locally; do not send credentials anywhere`
contains a separate transmission restriction.
A request-only prohibition axiom returning false does not erase that directive restriction.
Alternative permission witnesses cannot silently discard applicable standing prohibitions.
Keep witness-local conditions and broader constraints distinct;
unknown restriction scope or applicability requires review.
Precedence and explicit override handling remain code-owned and must be tested.

New grants retain original wording and present explicit scope before human confirmation,
as selected in Q9a.
Qualified prose reuse remains available under Q9b.
An unresolved match asks the user;
this is not permission to silently widen the structured scope.

### Human request provenance remains an integration gate

`src/context.ts` currently uses session messages as judge context
and custom session entries as active trust directives.
Its latest-user window is not proof that the latest `user` message was typed by the human.
The new collector must distinguish original human intent from automation,
continuations,
project context,
and tool payloads.

The [Pi input-provenance investigation](../troubleshooting/pi-input-provenance.md)
traces the installed 0.87.1 host and records an offline actual-method probe.
Its transient input event distinguishes channels,
but constructed user messages omit that field.
Programmatic prompts default to `interactive`,
transforms retain the channel label while changing content,
and input-handler errors do not veto prompt delivery.
Therefore neither role nor channel name alone is a verified human witness.

The collector must bind admitted original content to its actual entry and branch,
with explicit unresolved-origin handling if collection fails.
Do not transfer authority to a context-edited replacement solely because it retains the original role or entry identity.
Prefer provenance metadata referencing existing entries over duplicate transcript capture.
On resumed or externally populated history without sufficient provenance,
require explicit confirmation rather than guessing.
This is a proposed consumer treatment;
live TUI/RPC persistence and the collector integration remain unverified.

A subsequent isolated composition exercised actual Pi prompt/command dispatch and current project grant methods.
A programmatic prompt labelled `rpc` reached `/guard` before any input callback
and appended a directive with `hasUI: false`.
Ordinary text reached the input callback in its positive control.
Consequently,
each grant writer needs an admitted authority witness;
an input-event-only collector cannot cover registered commands.
This is not a live RPC-client exploit claim or an implemented collector remedy.
Qualified legacy prose remains eligible once its human authority is established.

The same probe confirmed branch-local reset projection:
moving before a reset exposed the prior directive again,
and returning to the reset entry cleared it.
An in-memory fork copied the grant entry's ID and text into a new session ID.
Bind provenance to the original session and entry,
not a copied entry ID alone.
No production revocation or inheritance policy was selected by this observation.

### Grant lifetime decisions and current frontier

Q14 through Q16 addressed reusable trust directives from `/guard` and `propose_trust`.
Q18 and Q19 separately extend the design to explicit human action-approval records.
Every inherited permission requires verifiable original human confirmation;
lineage alone cannot supply that witness.
The inspected `/guard reset` appends a null trust entry,
while action approvals are read separately by `getReusableApproval()`.
Q19 explicitly authorizes expanding reset to both record kinds within its session;
that change is not implemented.

The user selected Q14 A:
reset revokes prior directives across branches sharing the same session ID.
History navigation must not reactivate them.
The branch-local replay alternative was not selected.
This is an accepted design requirement,
not an implemented fix.

The user selected Q15 B:
a new forked session may inherit eligible directives through verified lineage
and a valid original human witness.
The earlier recommendation to require new confirmation for every fork was rejected.
Copied text or an entry ID alone cannot establish inheritance authority.
Explicitly broader grant scope remains outside this ordinary session-scoped default.

The user selected [Q16 B](pi-auto-mode-axioms.md#q16-revoking-inherited-directives):
resetting originating session A leaves its already inherited directive valid in verified fork B.
Revoke that directive in B separately.
The linked-revocation recommendation was rejected.
Keep B's current eligibility separate from whether the original directive remains active in A;
the original human-confirmation witness is still required.
A reset inside B has Q14's branch-wide effect for B's session ID.
No new global-reset behavior or storage/copy mechanism is selected.

For [Q17](pi-auto-mode-axioms.md#q17-new-request-conflicting-with-an-active-standing-prohibition),
the user classified the demonstrated same-human contradictory instructions as user error
and accepted any system response to that conflict.
Approve,
deny,
and ask are acceptable conflict outcomes when all independent requirements are satisfied.
Do not require the proposed confirmation or newer-request precedence.
Code still owns the deterministic choice.
No persistent directive edit,
unwitnessed authority,
fixed-block override,
or relaxation of semantic qualification follows.
Contradictory or uncertain model estimates alone do not establish this scenario.

### Existing approval reuse

`src/context.ts` currently reuses the latest matching `approve` or `user-approve` entry.
`src/tool-helpers.ts` fingerprints tool identity,
working directory,
loaded project context,
and input;
read ranges deliberately share one path scope.

Machine approval is not a human grant.
A decision produced by the old judge cannot be declared qualified under the new deterministic policy
solely because an old action fingerprint matches.
Preserve explicit human approval semantics where current action scope,
policy,
branch,
and provenance still match.
Any new qualification-dependent cache must also identify the definitions and profile that justified it.
The user selected [Q18 A](pi-auto-mode-axioms.md#q18-fork-inheritance-of-human-action-approvals):
a verified fork may inherit separate explicit human action approvals for the same eligible scope,
with the original human witness and current scope,
policy,
and freshness checks.
Old machine verdicts are not eligible through this human-approval route.
Q20 subsequently settled independent eligibility after an originating reset.
The user selected [Q19 A](pi-auto-mode-axioms.md#q19-reset-scope-for-remembered-human-action-approvals):
reset clears both directives and remembered human action approvals within its session.
Derived cached decisions cannot preserve an approval whose authority was reset.
The user selected [Q20 A](pi-auto-mode-axioms.md#q20-origin-reset-after-human-action-approval-inheritance):
resetting A leaves an already inherited human action approval eligible in B,
subject to all B's current scope,
policy,
provenance,
and freshness requirements.
Revoke it in B separately.
Both stored human permission kinds now share session-local reset and verified fork-inheritance semantics.

## Decision and finalization interface

The deterministic-policy module consumes facts,
required qualified estimates,
and their witnesses.
It returns an action,
a stable matched-rule identifier,
and evidence suitable for a factual explanation.
No model-generated final verdict or explanation enters this interface.

The finalization module rechecks the action snapshot,
policy fingerprint,
branch,
grants and revocations,
required filesystem observations,
deadline,
and cancellation before releasing an automatic approval.
A result cannot survive a changed input just because inference returned successfully.
The same freshness discipline must cover pending manual prompts and reused approvals,
with explicit treatment of what the human actually accepted.

Fixed blocks are evaluated before bypass or model estimates.
Existing explicit bypass remains a distinct user-controlled mode,
not a model output.
Unqualified,
missing,
malformed,
late,
or unsupported evidence cannot authorize a reviewed action.
Manual/headless behavior stays owned by `src/ask-user.ts` and the extension lifecycle.
No UI means no automatic substitute for human approval.

The total model-assessment wait is five seconds.
Our client may make at most two calls,
while gateway-internal retries are accepted by Q11.
An uncertainty result is not a transport failure and does not justify resampling until it looks approvable.
Late results are discarded even if the provider continues processing after cancellation.

## Verification work required before freezing this contract

For each effect and qualified input form,
retain independent positive,
negative,
quoted,
negated,
conditional,
unsupported,
and provenance-conflict cases.
Separate fixture admission from a production extractor implementation.
Keep the reserved scenario groups out of definition and threshold fitting.

Tests must cover same-grant witness binding,
human-versus-automation provenance,
branch changes,
revocation during inference or a prompt,
policy changes,
changed targets,
old machine-approval entries,
read-range reuse,
changed edit bodies,
missing modalities,
transport failure,
deadline expiry,
and headless review.
Current pure-policy vector tests and single-axiom model probes do not cover these integration paths.

Q17 does not require the initial prototype's conflict-to-ask outcome for its demonstrated human conflict.
The protected-transmission rule and threshold bands remain unadopted demonstration rules.
[Q21](pi-auto-mode-axioms.md#q21-governing-instructions-and-unspecified-outcomes)
requires applying governing instructions rather than imposing a transfer-specific default
based only on missing human requests or grants.
No outcome is specified when no relevant instruction applies;
unknown applicability is not that case.
Add source-authority,
priority,
policy-permission,
policy-prohibition,
required-approval,
and applicability-omission controls.
Frozen request/prose labels and their limited semantic results remain unchanged.
Do not freeze the prototype rule or thresholds by documentation alone.
The next work is to prototype provenance binding and its failure cases,
make the first-deployment profile applicability explicit without reinstating the rejected code-proof prerequisite,
and build corresponding independent fixtures and policy tests in private scratch.
