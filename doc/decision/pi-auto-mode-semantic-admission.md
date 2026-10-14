# Pi automatic-mode semantic admission

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

The policy fixes `typesafe/jev-1.13.0`
and the existing `awaited-string-result-then-literal-parallel` program inspection profile.
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
