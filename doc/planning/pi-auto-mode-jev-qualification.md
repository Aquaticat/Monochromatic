# Remaining Jev candidate qualification

## Status and scope

Candidate investigation continues before further integration-policy questions.
The earlier native development and overflow probes are useful evidence,
not production qualification.
See the [axiom record](pi-auto-mode-axioms.md)
and [current audit](../audit/tech-pi-auto-mode-axiom-migration-vet-2026-09-26.md).
No model winner,
threshold,
private upload,
account change,
or production cutover is selected.
The accepted AUP,
necessity-based retention,
and gateway-internal retry choices remain settled.

## Live metadata observations

A first-party read-only client at
`~/temp/agent/jev-service-metadata-2026-09-26`
made four GET requests,
all returning HTTP 200.
It made no model call and uploaded no assessment body.
Scratch commit `647c231` froze the client;
`d38b423` retains its sanitized result.
Process `proc_13bf` passed.
Result SHA-256:
`a687a8efcf4178c03a01944b5b57c352b341513eb689ca2bf983885fd6b0ca0f`.

The public mapped catalogue and authenticated `no_training=true` catalogue both included
`typesafe/jev-1.13.0` with TypeSafe as its mapping.
They reported input price `0.042e-6` per token and zero output-token price,
equivalent to $0.042 per million input tokens.
That is catalogue pricing,
not an invoice or a complete cost comparison.
The 64,000-token catalogue field does not replace TypeSafe's separate state-plus-longest-question limit.
The cancellation flag is metadata,
not proof of upstream cancellation or billing termination.

`GET /v1/key` reported `devPlan: none` and no key usage limit.
Key labels,
usage values,
account identifiers,
and credentials were excluded from the artifact.
That endpoint did not expose retention settings.
The source path `apps/gateway/src/key/key.ts` deliberately returns status/usage metadata,
whereas `apps/api/src/routes/index.ts` places organization settings behind dashboard-session authentication.

### Self-reported deployment tag

The live root health endpoint reported `v0.0.0-85d00d8` and status `ok`.
GitHub resolves that suffix to `85d00d8cb04db3de891998036bddd789181e12d3`,
whose parent is the audited `4affe8bf02559880fea74fa5ba685ad2cb19168d`.
Its listed changes are support-chat helpers/tests and UI/playground styling,
not System One routing,
model metadata,
or log retention.
This reduces a source-version ambiguity;
it does not independently attest the deployed binary,
configuration,
or upstream model.
No claim about provider substitution follows.

## Actual account settings remain unverified

Read-only bridges attempted:

- BrowserOS MCP connection failed with `fetch failed`.
- `agent-browser --auto-connect` found no running debug-enabled Chrome.
- The available named Chrome profile reached `https://llmgateway.io/login`,
  not an authenticated dashboard.
- The supplied inference key successfully read supported key/catalogue endpoints,
  but their schemas do not expose `retentionLevel`.

The named browser session was closed.
No credential was requested or exported,
no sign-up/OAuth consent was submitted,
and no account setting changed.
Todo #20 tracks the authenticated-account gate.
No global claim is made that account settings are inaccessible by every possible tool.
The user has not required ZDR or a fixed deletion deadline.

## Frozen operational research schedule

Private schedule:
`~/temp/agent/jev-service-audit-query-schedule-2026-09-26.json`.
Only TypeSafe/Jev and the already preferred LLM Gateway service were researched.
Unrelated `llmgateways.com`,
LangSmith gateway results,
and unaffiliated Jev sites were excluded as evidence about these vendors.
No vendor-discovery saturation claim is made.

Initial Radius queries,
each configured for twelve results and returning ten:

- `"LLMGateway" funding ownership layoffs status outage security breach account suspension support reviews 2025 2026`
  Search ID `search_9131a01921bd0975249ae6c9e3c059c7`.
- `"typesafe.ai" Jev company funding team status outage security breach customer support 2025 2026`
  Search ID `search_1ed54466a6dd802d3e04beecd81ab3bc`.

A frozen expansion addressed missing workforce,
customer,
and security evidence:

- `"llmgateway.io" billing refund suspension complaints security incident layoffs funding`
  Search ID `search_32bd1875548b90fd0fc69ca46c70824f`,
  ten returned results.
- `"typesafe.ai" DCVC funding layoffs employees security breach customer reviews support`
  Search ID `search_15e0a98d5e54da0d1f3e3a7efe37bfe2`,
  ten returned results.

## Service evidence and its limits

### Ownership, funding, and workforce

The [gateway About page](https://llmgateway.io/about)
identifies Polar Lights LLC as operator and describes a hosted credit-funded business,
free bring-your-own-key routing,
and self-hosting.
A [founder account](https://x.com/smakosh/article/2065105200960991515)
describes beginning the project with another founder in May 2025 without funding.
That is a dated first-party account,
not an independently audited current financial or headcount statement.
The inspected sources do not establish a complete 24-month workforce/layoff history.

TypeSafe's launch announcement reports $40 million in seed funding led by DCVC.
[DCVC's own announcement](https://www.dcvc.com/news-insights/typesafe-emerges-from-stealth-with-a-new-way-of-doing-ai/)
corroborates the round;
its [portfolio page](https://www.dcvc.com/companies/typesafe)
records first investment in 2025.
The [TypeSafe team page](https://typesafe.ai/team)
names founders and links open roles,
not total headcount or a complete employment history.
Funding is continuity context,
not proof of safety,
solvency,
or future service quality.

### Availability

The official [gateway status page](https://status.llmgateway.io/)
and [TypeSafe status page](https://status.typesafe.ai/)
were read at their September 27,
2026 UTC update.
Their displayed monitor histories cover ninety days,
not the requested full-year reliability window.
The gateway page displayed 99.995% for its Gateway monitor;
TypeSafe displayed 99.822% for its API monitor.
These vendor-reported monitor metrics are not measurements of this exact Jev route,
and must not be multiplied into an invented combined SLA.

Quarterly incident listings were followed from July to September 2025
through July to September 2026 for both services.
Older pages said no incidents reported.
That does not establish full historical retention,
complete reporting,
or zero downtime.
The gateway's incident list can be empty while its monitor timeline records downtime.

TypeSafe's current listing names API instability and latency/connection incidents
alongside a separate console incident.
The API entries include:

- [API issues](https://status.typesafe.ai/incident/1070670),
  resolved September 21 at 23:40 UTC.
- [Elevated API latency and connection issues](https://status.typesafe.ai/incident/1072436),
  resolved September 23 at 20:56 UTC.
- [Elevated API latency](https://status.typesafe.ai/incident/1072768),
  resolved September 24 at 07:18 UTC.

The fetched details expose resolution messages,
not a complete start-to-resolution chronology or root cause.
No incident duration or effect on this user's requests is inferred.
The [console incident](https://status.typesafe.ai/incident/1070098)
is kept separate from the API monitor.
Manual fallback remains necessary independently of any marketing failover claim.

### Billing, suspension, and support

[Billing documentation](https://docs.llmgateway.io/learn/billing)
states a 5% platform fee on credit purchases,
plus a 1.5% international-card fee when applicable.
The actual project mode,
payment method,
and fees charged to this account were not inspected.
Do not apply those fees to a catalogue token quote as though they were a measured invoice.

[Gateway terms](https://llmgateway.io/legal/terms),
updated September 18,
2026,
provide no standard free/PAYG service-level commitment.
They permit prospective pricing changes and suspension under stated conditions.
From October 15,
2026,
they add discretionary restrictions for high content-filter violation rates,
without promising notice or appeal.
A single blocked request is explicitly not itself a breach.
This is a relevant availability risk for classification traffic,
not an observed suspension or a reason to reopen accepted TypeSafe AUP section 1.5.

The [refund guide](https://docs.llmgateway.io/learn/refunds)
describes product-specific self-service conditions.
The terms announce a later reduction in the eligible usage fraction for new payments.
No refund,
subscription,
or payment operation was tested or requested.
The bounded searches did not establish a representative customer-complaint or appeal-success dataset.
Documentation is not customer-experience evidence.

### Security and signup evidence

The [gateway trust center](https://security.llmgateway.io/)
labels SOC 2 Type 2 compliant and GDPR in progress;
its penetration-test document is gated by NDA.
These are portal claims,
not an audit report inspected in this evaluation.
The source repository's `SECURITY.md` requests private GitHub advisories for vulnerability reports.

The [TypeSafe trust center](https://trust.typesafe.ai/)
required browser rendering.
It advertised a 2026 SOC 2 Type II resource,
but selecting it opened an access-request form.
No form was submitted or agreement accepted;
the browser was closed.
No private security report was obtained.
The inspected source set does not establish a complete breach or abuse history,
and missing search results are not evidence of absence.

Existing API access is verified.
New-account onboarding,
KYC,
payment eligibility,
and all jurisdiction-specific restrictions were not exercised.
The current user does not need another account merely to continue public/synthetic candidate probes.

## Next quality evidence

The existing fifteen-scenario batch remains development evidence.
Next bounded probes should use the exact shared control/quotation states,
retain every required policy byte,
and distinguish single-question output from the existing multi-question schema.
Repeated gateway responses measure the route as observed;
without further evidence they do not prove independent uncached model execution.
No held-out cases should be consumed to tune the request format.
No further grant-lifetime questions belong in this candidate phase.
