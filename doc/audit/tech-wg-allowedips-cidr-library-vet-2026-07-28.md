# Technology vet: wg-allowedips CIDR library

Status:
 in progress.
 Lifecycle phase is discovery complete and screening started.
 Started and last updated on 2026-07-28.

Subject:
 `wg-allowedips` CIDR library.

Decision scope:
 choose the CIDR parsing and subtraction dependency for `@monochromatic-dev/cli-wg-allowedips`.

Governing skill:

- Commit is `a05818ad70a40e5769a36de669697ba109891b31`.
- SHA-256 is `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
 `5463db7e7d141d35d67ed77a3f9b8ca8794e3dcccad51cd976bcc1f8d06e6e62`.

Active audit owner:
 Pi session `019fa84d-b4f0-704e-9646-9e7e04230d16`.

Prior compatible report:
 none found.

## Context

The current specification in `doc/planning/wg-allowedips.md` selects `cidr-tools >=12.1.2`.
The user asked to consider [`beaugunderson/ip-address`][ip-address-repo].
This evaluation compares that candidate against retaining the selected dependency.
It also screens other concrete alternatives found through the required discovery sources.

The CLI accepts IP literals and CIDR blocks for IPv4 and IPv6.
It unions the allowed input and subtracts the union of the disallowed input.
The output is a minimized sorted CIDR cover.
The user explicitly prioritizes the least production code and no special-case machinery.

## Classification

Every package candidate is an inspectable open-source local technology.
The incumbent dependency replacement overlay applies because `cidr-tools` is already selected by the plan.
The multi-platform overlay applies because the Node CLI must behave deterministically on Linux, macOS, and
Windows.

The high-trust overlay does not apply.
The library processes user-controlled address text but receives no credentials and performs no process execution.
The native and Wasm overlay does not apply to a survivor only if its complete runtime graph remains pure
JavaScript or TypeScript.
The SaaS and sensitive-data overlays do not apply.

## Hard constraints

A candidate must satisfy all of these constraints:

- deterministic operation on Linux, macOS, and Windows under Node.js 22 or newer;
- exact IPv4 and IPv6 union-minus-union with a minimized sorted CIDR cover;
- parsing and validation of IPv4 and IPv6 single addresses and CIDR prefixes;
- inspectable JavaScript or TypeScript source;
- no native code or Wasm;
- no prebuilt or downloaded artifact;
- no generated runtime whose source mapping is unavailable;
- no lifecycle install command;
- an LGPL-3.0-compatible open-source license;
- reproducible validation through the real `wg-allowedips` consumer operations.

No arbitrary start-to-end range syntax is required.
A candidate may combine a library with a small amount of project code.
The amount and complexity of that code are scored rather than used as a hard gate.

## Frozen criteria

Hard-gate failures remain outside arithmetic.
Every surviving finalist receives these criteria and weights:

- Interface fit and production-code footprint has weight 5.
  The user's least-LoC instruction controls this weight.
- Validation clarity and error ergonomics has weight 5.
  The CLI must reject invalid address and prefix input without a second parser subsystem.
- Runtime dependency surface and human auditability has weight 4.
  Unused feature breadth earns no credit.
- Upstream test quality has weight 3.
  Relevant value comes from IPv4 and IPv6 parser boundaries plus set-operation invariants.
- Maintenance and release hygiene has weight 1.
  No stronger preference was stated.

Each rating uses the skill's scale from 0 through 4.
The maximum weighted score is 72.
No unresolved preference remains before evidence collection.

## Frozen discovery schedule

### Npm registry

Run each literal query against the npm registry search API with a page size of 100 and no negative filter:

- `cidr ipv4 ipv6 subtract exclude merge`;
- `ip address cidr aggregate subtract`;
- `subnet ipv6 typescript range`.

Continue each query until the registry reports exhaustion or two complete pages add no screening survivor.
Sort by the registry's default relevance order.

### GitHub repositories

Run each literal query through GitHub repository search with 100 results per page and no negative filter:

- `cidr ipv6 subtract language:TypeScript`;
- `cidr aggregate exclude language:JavaScript`;
- `IP address subnet language:TypeScript`.

Continue each query until GitHub reports exhaustion or two complete pages add no screening survivor.
Use GitHub's default best-match order.

### Broader web

Run these literal queries through the configured web search provider:

- `JavaScript IPv4 IPv6 CIDR subtraction library`;
- `TypeScript CIDR merge exclude package`;
- `ip-address alternatives CIDR`;
- `cidr-tools alternative`.

The provider exposes no page cursor through this harness.
Record that limit and corroborate candidates through the registry and repository searches.

### This repository

Run an uncapped repository search for:

- `cidr-tools`;
- `ip-address`;
- `ip-bigint`;
- CIDR plus `subtract`;
- subnet plus `subtract`.

Inspect every matching plan, decision, audit, package manifest, catalog entry, and implementation.

### Expansion round

After the initial schedule completes:

1. Collect every new problem-class synonym from candidate metadata.
2. Append one de-duplicated query round to each applicable external source.
3. Freeze the expanded schedule.
4. Record later terms without adding more queries.

## Query ledger and saturation

### Npm registry initial schedule

The registry search API returned 100 results per requested page.
Its total counts changed slightly while the audit ran.
The page rule depends on new screening survivors rather than a stable total.

The query `cidr ipv4 ipv6 subtract exclude merge` reported about 47,662 results.
The first page discovered `cidr-tools`, `fast-cidr-tools`, `ip-num`, `ip-address`, and
`cidr-block`.
The page from offset 100 added `ip.js`.
The page from offset 200 added no survivor.
The page from offset 300 added `@h3mantd/ip-kit`.
The pages from offsets 400 and 500 added no survivor.
The query therefore met the two-page saturation rule.

The query `ip address cidr aggregate subtract` reported about 67,381 results.
The first page repeated the main candidates.
The page from offset 100 added `aggregate-cidr`.
The pages from offsets 200 and 300 added no survivor.
The query therefore met the two-page saturation rule.

The query `subnet ipv6 typescript range` reported about 404,185 results.
The first page repeated `ip-address`, `ip-num`, and `cidr-block`.
The page from offset 100 added `@cldn/ip` and repeated `ip.js`.
The pages from offsets 200 and 300 added no survivor.
The query therefore met the two-page saturation rule.

### Npm registry expansion round

Candidate metadata added the terms `prefix`, `pool`, and `summarize`.
The de-duplicated expansion query was `cidr prefix pool summarize`.
It reported about 43,648 results.
The first page contained only known candidates.
The pages from offsets 100 and 200 added no survivor.
The expansion source is saturated and the registry schedule is frozen.

### GitHub repository schedule

The query `cidr ipv6 subtract language:TypeScript` returned no repository.
The query `cidr aggregate exclude language:JavaScript` returned no repository.
The query `IP address subnet language:TypeScript` returned 26 repositories and was exhausted on its first
page.
It corroborated `ip-address` and `@cldn/ip` while adding only parser, matcher, application, or IPv4-only
projects.

The expansion query `cidr prefix pool language:TypeScript` returned no repository.
GitHub discovery is exhausted and saturated.

### Broader web schedule

The four frozen searches discovered or corroborated:

- `cidr-tools`;
- `fast-cidr-tools`;
- `@h3mantd/ip-kit`;
- `ip.js`;
- `cidr-block`;
- `ip-address`;
- `ip-num`;
- `@cldn/ip`;
- parser and matcher packages such as `ipaddr.js`, `ip-cidr`, and `netip-ts`.

The provider exposed no page cursor.
Registry and GitHub enumeration independently covered the plausible candidates and met their saturation rules.
No web-only result remained a screening survivor.

### Repository schedule

The uncapped repository search found `cidr-tools` only in `doc/planning/wg-allowedips.md`.
It found no `ip-address`, `ip-bigint`, CIDR-subtraction implementation, prior decision, or prior audit.
A separate address list in `package/config/tofu/hetzner.tf` was unrelated.

### Terminal discovery result

Discovery is saturated with more than one screening survivor.
The frozen expansion round is complete.
Later taxonomy terms will be recorded without adding queries.

## Candidate ledger after discovery

### `cidr-tools`

Discovery source:
 current plan plus npm, GitHub, and web results.

Screening result:
 serious alternative.
It documents direct IPv4 and IPv6 merge and exclusion over arrays.

### `fast-cidr-tools`

Discovery source:
 npm and web results.

Screening result:
 serious alternative.
It documents direct IPv4 and IPv6 merge and exclusion over arrays.
Its opt-in sorting and reported IPv6 issues require targeted source validation.

### `@h3mantd/ip-kit`

Discovery source:
 npm expansion and web results.

Screening result:
 serious alternative.
Its `RangeSet` interface documents union, subtraction, and conversion to minimal CIDRs for both families.
Its broad unused feature surface requires a human-auditability comparison.

### `ip-num`

Discovery source:
 npm registry and web results.

Screening result:
 serious alternative pending source confirmation.
Its pool and ranged-set interfaces document aggregation and range removal for IPv4 and IPv6.
The audit must confirm that arbitrary union-minus-union does not require recursive consumer logic.

### `ip-address`

Discovery source:
 user nomination plus npm, GitHub, and web results.

Screening result:
 serious alternative for targeted category-fit confirmation.
Its published interface provides strict parsers, subnet bounds, containment, and BigInt conversion.
It does not publish a collection union, subtraction, or minimal-cover operation.
Source inspection will determine whether it can replace the selected subtraction dependency.

### `cidr-block`

Discovery source:
 npm and web results.

Screening result:
 exited for category mismatch.
Its exhaustive published interface covers validation, bounds, overlap, splitting, and iteration but no
collection union or subtraction.
Using it would still require a separate set engine.

### `ip.js`

Discovery source:
 npm and web results.

Screening result:
 exited for category mismatch.
It converts one continuous range to a prefix cover but provides no collection union or subtraction.

### `@cldn/ip`

Discovery source:
 npm, GitHub, and web results.

Screening result:
 exited for category mismatch.
Its published interface covers address and subnet arithmetic plus collection merging but exposes no difference
operation needed by this CLI.

### `ip-bigint`

Discovery source:
 the current candidate's runtime graph and related-project list.

Screening result:
 exited for category mismatch.
It converts address strings and BigInts but does not implement set subtraction or CIDR-cover generation.

### Parser and matcher packages

This group includes `ipaddr.js`, `ip-cidr`, `netip-ts`, `node-cidr`, and similar registry results.

Screening result:
 exited for category mismatch.
Their published interfaces parse, normalize, test containment, or split one subnet.
They do not implement both union-minus-union and minimal CIDR-cover output.

### IPv4-only and aggregate-only packages

This group includes `aggregate-cidr`, `cidr-lib`, and several overlap or matcher packages.

Screening result:
 failed the dual-stack or subtraction hard constraint.

### Project-owned BigInt implementation

Screening result:
 deferred by open-source precedence and the existing-tools rule.
Ready-to-use serious alternatives survived discovery.

## Evidence records

Evidence collection has not started.

## Execution manifests

No third-party command tree has been executed.
Source clones and read-only metadata queries are not candidate execution.

## Scoring and sensitivity

Scoring waits for equal-depth finalist validation.

## Recommendation

No recommendation yet.

[ip-address-repo]: https://github.com/beaugunderson/ip-address
