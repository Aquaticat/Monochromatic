# Pi automatic-mode semantic admission

## Current Luna decision

On 2026-10-14,
the user selected Luna,
excluded Perplexity from further trials,
and explicitly accepted `0.8+` because the operating goal is to improve on manually judging every request.
The current target is `openai/gpt-6-luna-decisions` through the existing Gateway Decisions route.
A supported selected meaning is admitted at `0.80` or higher with a unique lead.
Unknown,
unsupported,
tied,
malformed,
or lower-scoring estimates remain unresolved.
This applies equally to permission,
restriction,
and absence interpretations;
the independent ownership,
authority,
coverage,
and authorization requirements remain intact.
The model score is an operating signal,
not a measured correctness probability.

The prior `0.99` choice was the agent's conservative heuristic under delegated authority.
It was scoped to Jev and was not empirically calibrated.
Treating it as a settled Luna requirement was incorrect.
Luna's initial primary permission estimate was `0.83`,
but only four of its 84 answers meet the newly adopted numeric boundary.
All distributions in that retained response satisfy the existing normalization tolerance;
the largest measured sum deviation is `2.220446049250313e-16`.
Changing the cutoff alone therefore does not complete native execution admission.

Implementation must change the fixed serving identity,
Gateway request and response conversion,
and operating cutoff together.
Verification includes boundary values,
negative decisions,
complete answer identities,
and original deadline accounting.
Question-format experiments must retain complete source input and criteria,
measure unchanged-input variation before comparisons,
and retain failures without retrying for a higher score.
The [Gateway probe record](../planning/pi-auto-mode-gateway-decisions-current-contract.md)
retains the initial serving evidence.

## Historical Jev decision

On 2026-10-14,
the user delegated both selection and adoption of the production acceptance rule.
The native host admits a supported categorical interpretation only when its selected score is at least `0.99`
and strictly exceeds every other score.
This is an operating cutoff,
not a measured accuracy rate or a statistical error bound.
The retained diagnostic studies did not qualify the current categorical definitions;
their historical cutoffs remain diagnostic.
No further paid qualification is authorized by this decision.

## Scope

The historical policy fixed `typesafe/jev-1.13.0`.
The original scope was `awaited-string-result-then-literal-parallel`.
On 2026-10-14,
the user also adopted `awaited-literal-single-call`:
a returned awaited tool call with a literal argument object,
or an immutable binding of that call followed by its direct return.
The fixed bootstrap scope `native-inspected-programs-v2` contains exactly these two decoder profiles.
Neither the scope identifier itself nor another program shape is an inspected operation.
Both profiles retain the same cutoff and independent authority,
source,
argument,
result,
and cancellation checks.
It applies separately to clause relationships,
whole-request content,
source-local heading content,
and express same-source quoted-unit incorporation.
It does not generalize to another serving model,
question definition,
or program profile.

Clause interpretations may admit `permission`,
`prohibition`,
`prerequisite`,
or `none`.
Request and heading interpretations may admit `none` or `potential-instruction`.
Unit incorporation may admit `adopts` or `none`.
`unknown`,
`unsupported`,
ties,
and scores under the cutoff remain unresolved.
Malformed or incomplete distributions fail validation.

The same cutoff applies to every admitted label,
including `none` and prohibition.
An estimate cannot discard a possible restriction with a weaker standard than it uses to interpret permission.
A highly scored `potential-instruction` still preserves the corresponding interpretation obligation.
An admitted prerequisite supplies no permission,
and incorporation does not establish source authority or valid delegation.

## Rationale and limits

The chosen rule favors abstention over using less decisive model answers.
Accepting every structurally valid answer would make uncertain interpretations operative.
A lower cutoff would admit additional answers without current evidence establishing that they are suitable.
Rejecting every estimate would prevent the adopted semantic consumer from operating.
Requiring exactly `1` would assign special significance to a model-reported endpoint that has no demonstrated
calibration advantage over the chosen operating cutoff.
Ranking:
the `0.99` rule precedes exact-`1` admission because it avoids treating a score endpoint as proof;
exact-`1` precedes lower-cutoff admission because it retains the stricter abstention preference;
lower-cutoff admission precedes accepting all answers because it still checks decisiveness.

No arithmetic combination of these scores establishes whole-decision accuracy.
Original ownership,
currentness,
source authority,
complete operation and instruction coverage,
and authorization satisfaction remain independent code-owned requirements.
Unresolved or unspecified policy blocks execution and does not implicitly request approval.
The existing approval path requires independently established permission and an eligible authorization requirement.
This direction is enforced by
`package/pi-plugin/auto-mode/native/contract/integration/action-policy/approval.mjs`
and `package/pi-plugin/auto-mode/src/guard-outcome.ts`.

Implementation and verification are tracked in
[the migration handover](../handover/pi-auto-mode-current-frontier.md).
