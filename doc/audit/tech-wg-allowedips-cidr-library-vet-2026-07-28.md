# Technology vet: wg-allowedips CIDR library

Status:
 in progress.
 Lifecycle phase is context and rubric frozen.
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

## Initial candidate ledger

### `cidr-tools`

Discovery source:
 current `doc/planning/wg-allowedips.md` selection and the package's related-project list.

Base category:
 inspectable open-source local technology.

Overlays:
 incumbent dependency replacement and multi-platform.

Screening result:
 pending equal-depth source and runtime validation.

### `ip-address`

Discovery source:
 user-nominated repository at [`beaugunderson/ip-address`][ip-address-repo].

Base category:
 inspectable open-source local technology.

Overlays:
 incumbent dependency replacement and multi-platform.

Screening result:
 pending category-fit and source audit.

### `ip-bigint`

Discovery source:
 direct runtime dependency and related project named by `cidr-tools`.

Base category:
 inspectable open-source local technology.

Overlays:
 incumbent dependency replacement and multi-platform.

Screening result:
 pending category-fit audit.

### Project-owned BigInt implementation

Discovery source:
 custom baseline from the originating design session.

Base category:
 project-owned local implementation.

Overlays:
 incumbent dependency replacement and multi-platform.

Screening result:
 eligible only if every ready-to-use technology fails a hard constraint.

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
