# Jev service and consumer qualification gates

## Status and scope

The user approved Jev through LLM Gateway for remaining qualification,
not production deployment or a confidence cutoff.
The [fresh semantic study](pi-auto-mode-jev-fresh-qualification.md#outcome-and-next-engineering-step)
is complete at its bounded scope.
This ledger separates settled input permissions,
service evidence,
residual vendor uncertainty,
and work owned by the real consumer.
It does not mark all production gates passed.

Task #65 refreshed the known primary documents on September 29,
2026,
without another model call,
account-setting change,
vendor contact,
or dashboard-authentication attempt.
The finite read schedule is `~/temp/agent/jev-service-gate-refresh-2026-09-29.json`.
Substantive legal and API references were followed;
the earlier source/client investigations were reused rather than repeated.

## Settled input and retention choices

The user already authorized all task-relevant assessment content through this named route,
including private or sensitive content.
Necessity-based retention and gateway-internal retries are accepted.
TypeSafe AUP section 1.5 is accepted for this evaluation.
Metadata-only account logging remains user-reported,
not independently inspected.
Dashboard access was declined and is not a prerequisite to reopen.
These choices are recorded in the [axiom design](pi-auto-mode-axioms.md#accepted-typesafe-aup-scope).

Current [TypeSafe privacy][typesafe-privacy],
updated November 19,
2025,
says it will not train or fine-tune models on Input,
allows service-provider processing,
and retains personal data as reasonably necessary.
Its [DPA][typesafe-dpa],
updated April 24,
2026,
uses documented instructions and necessity-based retention.
Its [MCA][typesafe-mca],
updated September 23,
2026,
separately addresses telemetry,
backups,
and customer-data processing.
No signed customer-specific agreement is claimed from reading these public templates.

Current [gateway privacy][gateway-privacy],
updated August 20,
2026,
also states that Customer Data is not used to train models.
Its [retention documentation][gateway-retention]
describes metadata-only as the default,
30-day retained-payload clearing,
and continued analytics metadata.
Its separate Responses API storage exception is not this System One route.
A documented default is not proof of this account's setting or of every error diagnostic.
The [pinned-source error-channel finding](../troubleshooting/llmgateway-systemone-boundaries.md#metadata-only-stripping-does-not-strip-upstream-error-text)
remains relevant and was already disclosed before the retention choice.

There is no new input-consent question here.
No-training,
no-retention,
and anonymization are different claims.
Omitting a gateway account identifier does not remove identifying information inside submitted content.
Do not send unrelated private data or export credentials merely because task-relevant input is authorized.

## Declared processors and unresolved internals

The [gateway subprocessor list][gateway-subprocessors],
version August 19,
2026,
identifies Stripe,
Google Cloud,
Resend,
and PostHog for their stated operational purposes.
Selected AI providers are a separate category.
The [TypeSafe provider entry][gateway-typesafe]
reports API training as No,
but prompt logging and retention as Unknown.
Unknown is not none.

The TypeSafe [public subprocessor page][typesafe-subprocessors]
initially yielded only a shell tagline through the web extractor.
An isolated unauthenticated browser session then rendered the public list,
showing all six entries:
Amazon Web Services,
Modal,
Slack,
Google Workspace,
Nebius,
and CoreWeave,
with USA locations.
The descriptions distinguish AWS storage/processing,
prompt processing without storage on the named compute providers,
and customer communication uses for Slack and Google Workspace.
These are vendor declarations,
not an observed route-by-route data-flow trace.
No access-request form,
login,
NDA,
or account setting was submitted.
The owned browser was closed.

The public processor list does not establish which hosts handled each experimental request.
The user has not required a fixed residency or ZDR setting.
Actual hosted retention,
cache behavior,
internal model identity,
and post-abort processing remain evidence limits,
not newly invented consent requirements.

## Model identity and request ownership

The [TypeSafe models page][typesafe-models]
continues to list `jev-1.13.0` and advises explicit version IDs rather than moving aliases.
The current public gateway catalogue and all accepted study replies reported
`typesafe/jev-1.13.0`.
Keep that requested route/version identity distinct from upstream weight attestation.
The [pinned gateway source](../troubleshooting/llmgateway-systemone-boundaries.md#request-forwarding-and-model-identity-are-different-evidence)
normalizes the returned model label;
matching text alone does not prove the underlying hosted model identity.
No hosted model substitution was observed or alleged.

The [current native API reference][typesafe-api]
and [gateway System One schema][gateway-systemone]
retain `model`,
`state`,
and named `questions` with matching answer IDs and usage fields.
TypeSafe explicitly says question-map keys are not used in inference.
Our identifiers bind responses in code;
question meaning must remain in the actual instructions,
criteria,
and supplied state.
No undocumented provider or retry field should be invented from a chat API example.

The gateway's general subprocessor guidance describes provider-prefix addressing and `x-no-fallback`.
For the inspected System One implementation,
that header does not establish an upstream attempt cap;
the reproduced retries rotate credentials for the same selected provider.
Do not reinterpret that finding as evidence of cross-provider fallback.
Requested version,
question contract,
policy,
and consumer profile must stay bound;
no automatic model substitution or coding-plan fallback is authorized.

## Complete input and context limits

TypeSafe publishes a 64k-token combined state/all-question limit
and a separate 32k-token state/longest-question limit.
Those are not the same constraint.
The retained gateway catalogue's 64000 context value does not replace the latter limit.
No exact local TypeSafe tokenizer boundary was established.

The client and reconstruction verified complete policy serialization and freshness.
The earlier [overflow controls](../troubleshooting/llmgateway-systemone-boundaries.md#live-public-context-limit-rejection)
observed `max_tokens_exceeded` rejection on their oversized fixtures.
Neither successful forwarding nor those rejections attest token-by-token preservation inside the hosted model.
Oversized or unqualified input must not be silently shortened and then treated as the same qualified assessment.
The user's complete-current-policy requirement remains unchanged.
The vendor's suggestion to filter irrelevant state does not authorize truncating `AGENTS.md`.

## Aggregate call cap and deadline

This section records the historical two-client-call contract used by the completed Jev study.
The later [batched-assessment contract](pi-auto-mode-batched-assessment.md#judgment-unit-and-cost-target)
permits at most three client attempts for a complete combined live judgment,
with earliest termination and the same preparation-inclusive five-second deadline.
That newer ceiling does not authorize replaying this study or treating the cap as a mandatory pipeline.
The original study evidence and its historical limits remain unchanged.

The [accepted Q10 and Q11 boundaries](pi-auto-mode-axioms.md#q10a-five-second-total-assessment-budget)
apply to the whole assessment:
five seconds before yielding to manual approval,
at most two client calls,
and at most one optional transport retry within those same limits.
The cap is not two attempts per source.

The tested request/prose path already uses both client calls and enabled no retry.
Adding a third call because one of those transports failed would violate the accepted cap.
Any future optional retry must fit the remaining aggregate call and time budget
without dropping required evidence.
The same provider's internal attempts and possible charges remain outside that client-attempt count,
as explicitly accepted.
No new retry preference question is needed.

The [current API guidance][typesafe-api]
suggests backoff for `429` and `529` responses,
and the model page warns that published rate limits may change without notice.
That guidance does not grant another five-second window,
a higher call cap,
or permission to switch models.
SDK default retries are not the tested first-party client's behavior;
no TypeSafe SDK was installed.

Accepted study pairs completed within the budget,
but the recorded pre-dispatch preparation failure did not finish within five seconds.
Discarding a late result protects authorization;
it is not the same as demonstrating timely user-visible handback during a blocked preparation step.
The real host consumer must exercise that boundary,
including late transport and stalled preparation.
Task #67's historical cause remains unassigned.
No latency guarantee is inferred from later successful traces.

Client cancellation and local loopback controls have evidence at their recorded scopes.
Hosted cancellation and cessation of billing after abort remain unverified.
Q11 already accepts that stopping our wait need not stop upstream processing or charges.
They are not reasons to repeat account access or impose a new end-to-end attempt cap.

## Service availability and terms

The [gateway terms][gateway-terms],
updated September 18,
2026,
provide no standard free/PAYG SLA.
They retain prospective pricing changes,
suspension rights,
and the announced October 15 content-filter restriction.
These are availability risks,
not evidence this account has been suspended.
No balance,
subscription,
top-up,
refund,
or auto-recharge setting was changed.

The TypeSafe MCA permits documented API integration into customer applications,
while retaining restrictions on model imitation,
competing services,
service security testing,
and misuse.
Gateway terms also retain high-risk-use restrictions and customer responsibility for evaluating outputs.
This review is not legal clearance for arbitrary future deployments.
It neither reopens the already accepted AUP choice nor treats that choice as a waiver of all other terms.
No Jev-output training,
service penetration test,
or provider-contact request is authorized by this ledger.

The previously inspected status histories and vendor security claims retain their recorded limits.
Do not turn a live API success,
a public SOC claim,
or an empty incident listing into a service guarantee.
No broad vendor-discovery or maintenance audit was restarted.

## Qualification still owned by the consumer

The [Jev 1.13 limitations page][typesafe-jaggedness],
reviewed by its publisher on September 17,
2026,
warns about indirection,
irrelevant context,
adversarial state,
and unsupported arithmetic identities across separately asked questions.
It explicitly says state is not treated as hostile by default and adversarial instructions can move answers.
That is a vendor limitation,
not a reproduced exploit of this prototype.

The fresh bank was not an adversarial-steering or multilingual qualification.
Its recurring pathname/other-file binding errors remain required negative controls.
Independent positive-relation and prohibition values are not complements;
code must not renormalize them or infer one from the other.
Parser-established facts,
arithmetic,
source eligibility,
and final policy decisions remain code-owned.

The remaining consumer gates are:

- A real human-origin witness and verified grant eligibility,
  rather than fixture authority or a message role alone.
- Governing-instruction source authority,
  priority,
  and applicability under Q21,
  including policy-derived permission from legitimate `AGENTS.md` rules.
  Request/prose semantic results do not qualify this additional authority path.
- The accepted reset/navigation/fork behavior,
  including Q16 B's independent eligibility after the originating session resets,
  and the remaining lifetime rules for separate human action approvals.
- The complete effect and policy inventory under Q13 B,
  including qualified semantic-effect estimates for inspected forms where code has not established effects.
  Do not replace that choice with a code-only-effect prerequisite.
- Versioned profile applicability,
  real evidence freshness,
  source-language/adversarial coverage appropriate to the admitted forms,
  and a chosen cutoff supported by its complete retained evidence.
- Finalizer behavior under missing,
  uncertain,
  contradictory,
  stale,
  cancelled,
  or late evidence,
  with no coding-plan fallback.
- Actual host-level deadline and user handback behavior,
  not merely isolated successful transport timing.
- Replacement responsibility coverage and final shared-understanding confirmation before production mutation.

These are not solved by another generic provider comparison or a dashboard inspection.
The user has explicitly resumed the integration interview and selected Q16 B:
resetting the originating session leaves its already inherited directive valid in the fork.
Q17 accepts any approve/deny/ask outcome for its demonstrated same-human instruction conflict,
without relaxing independent safeguards or changing standing directives.
Q21 requires following applicable governing instructions;
only a case with no relevant instruction has no user-specified outcome.
Unknown applicability is not established absence.
The [current interview frontier](pi-auto-mode-axioms.md#resumed-integration-interview)
tracks the remaining choices.
Q22 confirms shared understanding for the private contract and real-consumer qualification phase.
Production remains unchanged;
the remaining engineering gates and a separate cutover decision are still required.

[typesafe-models]: https://docs.typesafe.ai/models
[typesafe-api]: https://docs.typesafe.ai/api
[typesafe-jaggedness]: https://docs.typesafe.ai/model-jaggedness/jev-1.13
[typesafe-privacy]: https://typesafe.ai/legal/privacy-policy
[typesafe-dpa]: https://typesafe.ai/legal/data-processing
[typesafe-mca]: https://typesafe.ai/legal/mca
[typesafe-subprocessors]: https://trust.typesafe.ai/subprocessors
[gateway-systemone]: https://docs.llmgateway.io/v1_systemone
[gateway-retention]: https://docs.llmgateway.io/features/data-retention
[gateway-privacy]: https://llmgateway.io/legal/privacy
[gateway-terms]: https://llmgateway.io/legal/terms
[gateway-subprocessors]: https://llmgateway.io/legal/sub-processors
[gateway-typesafe]: https://llmgateway.io/providers/typesafe
