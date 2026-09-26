# Auto-mode effect and authorization contract

## Status and scope

This is a proposed contract inventory,
not production policy or an adopted implementation.
It extends the [axiom design](pi-auto-mode-axioms.md)
beyond the private protected-read,
protected-transfer,
and cache-removal demonstration.
The accepted interview choices in that design remain authoritative.
Q13 B permits qualified semantic effect estimates to support approval for validated inspected script forms,
without separate code-established effect analysis.
The stricter code-admitted-operation-family alternative was not selected.
No production files are changed by this investigation.

The migration replaces the existing reviewed-action path,
not every tool's execution semantics.
Do not silently expand guard coverage or describe existing unflagged tools as newly verified safe.
Additional unsupported reviewed actions may require manual approval,
as already accepted by the user.

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
Consequently,
a new finite policy cannot claim semantic parity merely because it returns the same action labels on examples.
Every retired behavior needs a new rule owner or an explicit manual-review disposition.

## Assessment snapshot

The evidence-collection module must produce an owned immutable snapshot before inference.
Its proposed fields are:

- Exact tool-call identity and complete current input,
  with the intended execution stage.
- Canonical working directory and resolved targets where code establishes them.
- Complete freshly read policy bytes and digest.
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

Semantic questions may concern whether a trusted request names this operation or resource,
or whether admitted executable content attempts a specified access.
Filename mentions,
quoted commands,
and printed strings are separate negative examples.
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

Required evidence containing a credential cannot be uploaded as assessment content.
If code cannot produce sufficient admissible non-secret evidence without altering the question's meaning,
use a qualified local path or manual review.
Do not use remote assessment to decide whether transmitting its own required input was authorized.
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

### Deterministic authority, semantic scope

Human acceptance creates the grant.
Axiom probabilities may assess only whether a named operation,
resource,
destination,
or condition matches that already accepted grant.
A model cannot manufacture authority from plausible wording.

For each possible authorization witness,
keep all required scope dimensions tied to the same grant identity.
Do not combine a permitted operation from one grant with a permitted resource from another.
Fully satisfied independent grants can be alternative witnesses.
The model should not answer whether it has found enough authorization overall;
code evaluates the witness predicates.

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

The initial prototype's conflict precedence,
protected-transmission rule,
and threshold bands remain demonstration rules.
Do not freeze them by documentation alone.
The next work is to prototype provenance binding and its failure cases,
make the first-deployment profile applicability explicit without reinstating the rejected code-proof prerequisite,
and build corresponding independent fixtures and policy tests in private scratch.
