---
name: choosing-technology
description: Use when picking a SaaS vendor, library, framework, build tool, or technology for this repo.
---

# Choosing technology and vendors

Fires before any candidate is named.
Walk this skill end-to-end whenever the task involves recommending a SaaS vendor,
picking a library, framework, or build tool,
evaluating options between two or more technologies,
vetting a vendor for safety,
or swapping out an existing package for a different one.

Other surface phrases that should trigger the skill:
"pick X", "recommend Y", "choose between A and B", "evaluate options for Z",
"vet this vendor", "select a library", "swap out package N",
"what should we use for", "we need a Z".
When the request mentions a deployment target or constraint
(latency, scale, geography, self-hosted vs SaaS),
the constraint picks the technology, not familiarity with the surrounding stack.

The skill encodes three layers:
context-fork questions (asked first),
vendor vetting layers (six checks for SaaS candidates),
and tool selection rules (open-source default, alternatives survey, decision-doc maintenance).
Skip none of the three.
Report findings inline, not as trailing caveats.
A recommendation made after checking only "do they satisfy the constraints" is a guess;
the user catches the gap when they sign up and discover the problem themselves.

## Context-fork questions first

Identify facts about the user's deployment, role, or constraints
that would push the recommendation in completely different directions.
If unspecified and the answer would change the candidate set itself,
ask via `AskUserQuestion`.
One clarifying turn is far cheaper than researching the wrong tree.

Typical context-fork dimensions:

- Primary delivery vs backup.
- Personal vs business-critical workload.
- Self-hosted vs serverless vs managed.
- Free-only vs willing-to-pay (and the price ceiling).
- Geography or compliance (HIPAA, GDPR, SOC2, data residency).
- Single-user vs team vs public-facing.
- Existing stack constraints (Node-only, Bun-supported, browser-baseline).

The cue you are about to violate this rule: about to name a candidate
without having any of these dimensions pinned down for the user's situation.

## Vendor vetting layers

Once context is set, complete every layer before naming any SaaS candidate.
Report findings inline alongside the recommendation,
not buried in trailing caveats.

1. **Layoffs and headcount** (24-month window).
   Sources: TechCrunch layoff tracker, Crunchbase, Glassdoor.
2. **Customer reviews**.
   Sources: Trustpilot, G2, Capterra.
   Look for account-suspension patterns,
   billing-automation horror stories,
   support-quality complaints.
3. **Recent outages** (12-month window).
   Sources: official status page plus an aggregator (statusgator, isdown).
4. **Funding and business model**.
   Bootstrapped vs VC vs PE; recent M&A or offers received.
   Affects shareholder pressure to extract from existing customers.
5. **Signup-friction signals**.
   Email-domain blocks, KYC, geography blocks.
   Correlate with heavy-handed automation that produces post-signup account-policy issues.
6. **Security and abuse history**.
   Breaches, phishing-host reputation, abuse-report responsiveness.

A vendor that satisfies the technical constraints but fails one of these layers
is a worse recommendation than a vendor with a weaker feature set and a clean record.

## Tool selection rules

For libraries, frameworks, and build tools (technology, not SaaS),
apply these rules in order.

### Open-source default

Treat open-source licensing as a default constraint
unless the user explicitly asks for commercial or proprietary options.
Do not recommend closed-source SaaS or proprietary tools ahead of open-source alternatives
for repo workflows.
If a closed-source option is still worth mentioning,
label it as an exception and explain why the open-source options fail the stated constraints.

### Constraint-fit before stack-fit

When the user states a hard performance, scale, latency, or compatibility constraint,
let the constraint pick the technology,
not the surrounding monorepo or your familiarity.
Greenfield projects: existing stack is a soft preference, not a constraint.

The phrases "since you're already using X" or "to match your stack"
are evidence this rule is firing and you are about to violate it.

### Tool-fit before first-principles

When the problem class has existing tools, surface them before proposing a hand-rolled solution:

- Graphics, rendering, many-entity work: name game engines (Bevy, Godot, Unreal).
- Databases: name existing engines.
- Collaboration: name CRDT libraries (Yjs, Automerge).

Build from scratch only when an existing tool's constraints conflict with stated requirements,
and state the conflict.

### Survey alternatives before recommending

The same rule fires for dependency replacements, not just greenfield choices.
When recommending swapping out an existing package,
survey ready-to-use alternative packages first.
"Write our own thin wrapper" is the last option, not the first.

Search the npm registry by keyword, search GitHub by topic,
and name every meaningful candidate inline.
About to recommend a hand-rolled module without having named at least two real packages
and the concrete reason each fails the constraints?
Stop; that is the violation signal.

### Name two alternatives with rejection reasons

When proposing a technology,
name at least two alternatives with concrete reasons
(cite the specific incompatibility, not "doesn't fit")
for not picking each.

### Audit open-source maintenance before recommending

For open-source packages, issue count alone is not a maintenance signal.
Measure maintainer responsiveness and recent triage before recommending a new direct dependency
or keeping an incumbent package under review.
Report counts with interpretation, not as raw trailing caveats.

Required checks:

- Recent issue response: sample issues created or updated in the last 12 months;
  count how many receive maintainer, member, owner, or collaborator comments,
  and separately count maintainer actions such as labeling, closing, linking a PR, or assigning.
- Pull-request activity: recent maintainer-authored PRs, maintainer reviews, merge latency,
  and whether external fixes wait without review.
- Release cadence: latest npm publish, changelog or release notes tied to fixes,
  and whether the package publishes after merged maintenance work.
- Backlog shape: stale unanswered bugs, compatibility breakages, security reports,
  and user comments that mention abandonment or missing support.
- Candidate parity: audit alternatives to the same depth as the incumbent;
  zero issues on a tiny repo is low signal, not proof of health.

Distinguish these states explicitly:

- Active releases with weak public issue support.
- Responsive maintainers with a large but triaged backlog.
- Abandoned or effectively unmaintained packages.

Never cite open issue count alone as evidence for or against a package.

### Maintain a decision document

After the user picks, write the choice and rejected alternatives to
`docs/decisions/<project>.md` or a decision doc co-located with the package.
Without it, the same rejected paths get re-proposed and the user pushes back again.

## Signals you are violating the rules

- Proposing a technology without listing alternatives.
- Skipping the decision-doc update after the user picks.
- Silent anchoring: defaulting without writing the default down for inspection.
  The verbalised form ("since you're already using X") is the easy catch;
  the silent form is the common failure
  (the assumption never reaches the response,
  so neither you nor the user can see it).
  Remedy: write the candidate set explicitly even when one option feels obvious.

## Worked example

User asks: "We need a managed Postgres provider for staging."

### Context-fork answered

Ask first, before naming candidates:

- Self-hosted vs SaaS? SaaS, per the question.
- Free-only or willing to pay? Up to ~$50/month for staging.
- Geography or compliance? US-east, no compliance requirement.
- Backup of an existing primary, or new primary? New primary.

### Vendor vetting layers (for each SaaS candidate)

Candidates surveyed: Neon, Supabase, Render Postgres, RDS-with-Postgres.

For each, walk the six layers and report inline:
layoffs (Neon raised in 2024; Supabase YC plus Series B;
Render bootstrapped-then-VC; RDS sits inside AWS),
customer reviews (Trustpilot, G2),
outages (statusgator timeline),
funding (VC pressure varies),
signup friction,
security (each has a public security page).

### Tool selection rules applied

- Open-source default: Neon, Supabase, and Render's Postgres are open-source-compatible
  (Postgres the engine is open source; the SaaS layer is proprietary).
  RDS is the proprietary option; label it the exception.
- Constraint-fit: latency under 100ms from US-east means all four are US-east-available.
  Storage cap matters for $50/month;
  Neon's branch model differs from Supabase's row-based storage.
- Alternatives surveyed: yes, four named.
- Decision doc: write `docs/decisions/staging-database.md`
  with the four candidates and the rejection reason for each non-winner.

### Recommendation

State the winning candidate inline with the findings,
not at the top with findings buried.

"Neon is the recommended choice
(clean vetting across all six layers;
matches the $50/month constraint via branch-based storage;
alternatives Supabase, Render, RDS each fail constraint X).
Decision doc: `docs/decisions/staging-database.md`."

## Quality check before naming a candidate

- Context-fork questions answered
  (asked the user or the constraints in the request determined the answer).
- All six vendor vetting layers reported inline for each SaaS candidate.
- At least two alternatives named with concrete rejection reasons.
- Open-source default applied; closed-source exceptions labelled with a reason.
- Open-source maintenance signals checked for library, framework, and build-tool candidates:
  issue responsiveness, maintainer actions, pull-request activity, release cadence, and stale backlog shape.
- Decision doc updated at `docs/decisions/<project>.md`.

If any item is unmet, do not name a candidate yet.
