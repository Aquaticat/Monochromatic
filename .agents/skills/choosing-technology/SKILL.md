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
and tool selection rules (open-source default, alternatives survey, dependency replacement parity,
decision-doc maintenance).
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
- Trust boundary of the dependency: does the code execute inside another agent
  or tool, handle credentials, or run in CI? Such packages raise the weight of
  human-auditability (see that rule) and of source provenance, and can flip a
  recommendation toward a leaner, more verifiable candidate.

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

### Dependency replacement parity audit

When proposing a package to replace an incumbent dependency,
audit each candidate to the incumbent's depth before recommending it.
Required checks:

- Transitive dependencies.
- Source paths handling the cases the incumbent mishandles;
  cite path and behavior.
- Build provenance for native or Wasm modules: compiler flags,
  imported host functions, source archives, checksum or release verification.
- Maintenance signals: downloads, stars, last commit, release cadence,
  maintainer concentration, issue and PR responsiveness.

Report findings inline with the recommendation, not as trailing caveats.
Without this depth, the recommendation swaps a known-flaw dependency
for an unknown-flaw dependency.

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

### Clone and spot-read source before recommending

For open-source libraries, frameworks, and build tools,
clone every finalist and every serious alternative that survives basic metadata screening
under `/tmp/agent/` before recommending one.
Use the repository-cloning convention from the main agent rules:
private `/tmp/agent` root,
`gh repo clone <repo> /tmp/agent/<descriptive-name>-<date-or-random> -- --depth 1`,
unless history is part of the investigation.
Do not rely only on README, npm, registry, stars, issue counts, or generated docs.
A metadata-only recommendation is unfinished.

Required source audit:

- Spot-read production source paths for the promised behavior and the integration boundary
  the repo would depend on.
  Cite files and behavior, not just package names.
- Spot-read tests and CI configuration.
  Identify unit, integration, end-to-end, property-based, and fixture tests,
  plus any coverage configuration or published coverage report.
  Absence of coverage evidence is a finding.
- Search for fuzzing and mutation-testing evidence.
  Look for fuzz harnesses, corpora, arbitrary generators, property tests,
  and tools such as cargo-fuzz, libFuzzer, AFL, proptest, quickcheck, fast-check,
  Stryker, mutmut, or language-equivalent mutation runners.
  If present, spot-read the harness invariants and how runs are wired into tasks or CI.
  If absent, report absence inline.
- Inspect code-quality signals from source itself:
  module size, type strictness, lint rules, generated-code boundaries,
  native or Wasm safety boundaries, escaping or parser boundary tests,
  and error-handling shape.
- Run the candidate's full validation, not a lightweight spot-check.
  Build it, run its test suite, and exercise the integration boundary the repo would depend on.
  Metadata, a directory listing, or a single targeted check is not a vet.
  When validation is heavy or unsafe to run on the host, run it in a fresh container or VM
  with explicit resource bounds (see the resource-isolation rules); isolation is the answer, never skipping.
  A candidate that is impractical to verify (cannot be built, cannot be run, has no reproducible validation path)
  is disqualified by that fact: the tool is toast.
  Impracticality to verify is a finding against the tool, not an excuse to recommend it unverified.

Report exact cloned paths, files, and commands inspected inline with the recommendation.
If a candidate cannot be cloned or lacks public source,
state that limitation before comparing it with source-audited alternatives.

### Weight human-auditability as a selection factor

Code that executes inside another tool (a coding-agent extension, a plugin,
a hook, a CI runner, a library that handles credentials) carries a trust burden
the user inherits, not the recommender. After the source audit, measure how
hard that code is for a human to verify as a selection criterion in its own
right, distinct from whether you already read it.

Measure these factors inline for finalists, since they flip recommendations
even when the feature set favors the larger candidate:

- Code volume and file count. Fewer non-test lines across fewer modules is a
  smaller surface a human can actually finish reading.
- Runtime dependency count, and whether those deps are the author's own
  packages. Each runtime dep, especially a same-author utility package the
  recommender did not already audit, extends the audit beyond the candidate's
  own repo.
- Architecture shape. Flat, linear, top-to-bottom control flow is easier to
  trace than an event bus, plugin handshake, or distributed state machine that
  forces the reader to jump between files to follow a request.
- Concentration of security-critical code. Credentials, network calls, and
  filesystem access grouped into a few obvious named files are easier to verify
  than the same concerns spread across many modules.
- Platform or rendering surface. Less TUI/UI rendering and less generated-code
  boundary code is less to verify.

When two finalists both satisfy the hard constraints and one is materially
more auditable, name the tradeoff explicitly (feature richness vs
verifiability) and let the user's tolerance for unaudited surface weigh in;
do not default to "more features wins." This is especially decisive when the
user is not using the features the larger candidate adds: the extra surface
buys nothing and costs trust the user must carry.

The cue you are about to violate this rule: about to recommend the candidate
with the richer feature set without having compared its auditability surface
to a leaner alternative, or without checking whether the user actually uses
the features that justify the larger surface.

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
- Recommending the most feature-rich candidate without comparing its
  auditability surface to a leaner alternative, especially for code that
  executes inside another agent or handles credentials, or without checking
  whether the user actually uses the features that justify the larger surface.

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
- Open-source source audit completed for finalists and serious alternatives:
  cloned repos, production source spot-read, tests and CI inspected,
  fuzzing or mutation-testing evidence found or reported absent,
  code-quality signals read from source itself.
- Full validation run for finalists: built, test suite run, integration boundary exercised
  (in an isolated container or VM when heavy); any candidate impractical to verify rejected.
- Dependency replacements include parity audit: transitive deps, source-path behavior,
  native/Wasm provenance, and maintenance signals.
- For finalists that execute inside another tool, handle credentials, or run
  in CI: human-auditability surface compared inline (code volume, runtime deps
  including same-author packages, architecture shape, concentration of
  security-critical code, rendering surface), and the feature-richness vs
  verifiability tradeoff named when it could flip the pick.
- Decision doc updated at `docs/decisions/<project>.md`.

If any item is unmet, do not name a candidate yet.
