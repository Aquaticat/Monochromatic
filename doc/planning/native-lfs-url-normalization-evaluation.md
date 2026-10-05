# Native LFS URL normalization evaluation

## Outcome and authority

Status: **blocked during evaluation setup, before external discovery**.
Started and last updated: 2026-10-05.
Owner: scoped delegate session `01a109e2-f31f-779e-98f4-4a3b3b1aec5c`.

No native URL owner is recommended or adopted.
Neither the Rust `url` family nor native Ada bindings have been vetted by this session.
They remain discovery leads from the delegation, not screened candidates.
Repository-content changes are limited to planning and audit evidence;
private scratch and throwaway-worktree experiments were also expressly permitted.
Rust, JSONC, native Git ownership, Sätteri, and the semantic parser are settled and were not reopened.

The execution guardrail rejected creation of the private TypeScript helper
`/home/user/temp/agent/native-lfs-vet-2026-10-05/report-write.ts`.
Its purpose was fingerprint checking, create-new report locking, and atomic audit-report writes.
The exact diagnostic began:

> This writes an executable TypeScript helper outside the repository, and its guardrail plus staged
> report-writing purpose make it a sensitive workflow action rather than an ordinary project edit.

The diagnostic also stated:

> No approval UI is available in this session.

The delegate requested a session trust rule through `propose_trust`:

> Allow private scratch TypeScript helpers for this native LFS URL evaluation, including bounded
> container experiments and atomic planning/audit report writes.

The tool returned:

> Rejected: no interactive UI available.

The blocked action was not retried or translated into another execution mechanism.
This is an execution-authorization blocker, not a finding that any URL library fails compatibility.
`.agents/skills/choosing-technology/SKILL.md:460` requires create-new locking and atomic audit-report writes;
its `Substantial-evaluation threshold` section at line 365 requires a report when a serious alternative
is promoted using external evidence or external discovery ends with no serious alternative or a blocked source.
The rejected helper was an attempted implementation of those requirements, not a prescribed implementation.
This rejection does not prove that every other authorized reporting or evaluation mechanism is unavailable.
The session stopped before promoting a serious alternative or running external discovery,
without retrying or rephrasing the specific blocked action.
The substantial-evaluation threshold for a `doc/audit/` vet report was not crossed.
This planning record preserves local observations collected before the blocker,
without claiming to be a completed vet report.

## Governing workflow

The inspected `.agents/skills/choosing-technology/SKILL.md` has:

- Last modifying commit: `37117e36397e30233062828581a5e38217da9458`.
- SHA-256: `552ac9955299b65a9f921a4e836b60a3fabc15d3477eeb8ec2bfb3f400647f9b`.
- Required lifecycle: discovery, screening, targeted hard gates, finalist validation, scoring, recommendation.
- Evaluation boundary: no product, dependency, configuration, installation, or decision-record mutation.

These identifiers were measured with `git log -1 --format='%H' -- .agents/skills/choosing-technology/SKILL.md`
and `sha256sum .agents/skills/choosing-technology/SKILL.md` from the repository root.

## Measured incumbent and environment

The local Node executable reported `v26.10.0` and `process.versions.ada` reported `4.0.0`.
The host reported Linux and x64.
`PI_REWRITE_DELEGATE_DEPTH` reported `1`.
The probe was `node --input-type=module -e` reading `process.version`, `process.versions.ada`,
`process.platform`, `process.arch`, and the delegation environment variable.
It completed successfully on 2026-10-05.
This identifies the local differential oracle; it does not prove equivalence to a standalone Ada release or binding.

`podman image inspect` successfully resolved the supplied Rust image
`84f24e75017a7d8afa1c69e51c52f37e7d8d644cd2597a01f4732ad0b386dc20` as `linux/amd64`.
Its recorded default command adds `rust-src` for `1.97.0-x86_64-unknown-linux-gnu`.
The image was inspected but not run.
Its existence is not validation of a candidate or of a third-party command tree.

The setup created the private scratch root and technology-vet lock directory,
with permission mode requested as `700`, before attempting the helper write.
No third-party repository was cloned, no network discovery query was sent,
and no native build, test, fuzz, or benchmark command was executed.

## Consumed contract

Primary evidence is fresh local source inspection, not a candidate runtime experiment.

`package/cli/markdown-lint/src/lfs-config.ts:147` defines `lfsObjectBase`.
Its operation is:

1.  Parse the endpoint with `new URL(lfsUrl)` without a base URL.
2.  Assign the empty string to `username` and `password`.
3.  Assign the empty string to `search` and `hash`.
4.  Read `href`.
5.  Remove exactly one final slash if the serialization ends with `/`.

The function does not restrict the scheme to HTTP or HTTPS.
It does not manually split authority, host, port, or path.
Parsing errors propagate rather than returning an empty base.
The native owner must preserve these semantics rather than substitute RFC-only parsing,
accept a smaller syntax subset, or strip all final slashes.
The comment that serialization always supplies a path of at least `/` is not the executable contract;
its generality across schemes has not been tested in this session.

`parseLfsConfig` scans declarations in file order and normalizes every collected endpoint.
`readLfsObjectBase` then selects the first normalized declaration.
Thus a malformed later declaration can still fail the read; first-selection-before-normalization is not equivalent.
An absent configuration file produces an empty list through the existing absent-path handling.

`package/cli/markdown-lint/src/lfs-config.unit.test.ts` directly covers:

- Removing userinfo, query, fragment, and a final slash.
- Preserving an endpoint path prefix.
- Reading `lfs.url` and remote-section `lfsurl` declarations.
- Ignoring comments, blank lines, and unrelated keys.
- Declaration ordering.
- Selecting the first base and handling an absent file.

These test files were read, not executed.
Their endpoint examples do not establish the full accepted URL language.

## Concrete integration boundary

The future dependency boundary is a pure native operation taking an endpoint string
and returning the normalized base string or a propagated parse failure.
Use the selected parser's own credential, query, fragment, and serialization operations.
Keep exactly-one-final-slash removal as the repository-owned post-serialization step.
Do not add networking, filesystem access, Git configuration precedence, image classification,
Markdown parsing, or URL joining to the dependency's responsibilities.

`package/cli/markdown-lint/src/lfs-image-context.ts` distributes the normalized `objectBase`
through repository discovery and per-file context preparation.
`package/cli/markdown-lint/src/lfs-image-target.ts::objectUrlParts` recognizes an object URL
through an exact string prefix `${objectBase}/`, then extracts the oid and repository path.
It does not normalize every image destination through Node's `URL`.
`relativeTargetPath` has separate filesystem-relative classification and resolution responsibilities.

`package/cli/markdown-lint/src/rule/lfs-image-url.ts::objectUrl` forms object destinations
by literal concatenation of base, oid, and repository-relative path.
Replacing that concatenation with a URL library's `join` would change the consumed boundary.
The rule also uses the exact base prefix to distinguish object and relative destinations.
A changed base serialization can therefore affect both emitted fixes and recognition of existing object URLs.

`package/cli/markdown-lint/src/rule/lfs-image-url.unit.test.ts` was read fresh.
It covers inert context, relative rewrites, titles, angle brackets, dot segments,
external and escaping destinations, matching and stale oids, missing and untracked targets,
image-reference definitions, link-only definitions, MDX, diagnostic anchors, and idempotence.
These are downstream parity obligations, not evidence that a native candidate has satisfied them.

## Existing decision search

The local searches inspected `doc/decision`, `doc/audit`, relevant planning documents,
and package Rust manifests/source for the literal terms `ada-url`, `url::`, `WHATWG`,
`URL parser`, and `URL parsing`.
No compatible existing URL-owner decision was identified in those searches.
This is a scoped search result, not proof that no related material exists anywhere in ignored artifacts.

`doc/planning/unified-linter.md` requires exact incumbent rule findings and localized fixes,
removes Node from Markdown linting, and identifies the native linter consumer.
`doc/planning/cli-git-rust-implementation.md` retains Linux, macOS, and Windows consumer coverage.
A resumed evaluation must establish the URL component's applicable platform evidence;
it must not confuse Linux-only probing or cross-compilation with execution on another platform.

## Outstanding evidence queue

No discovery schedule was executed or claimed saturated.
The private-helper authorization remains unresolved.
The guardrail directed the delegate to return the action and reason to the parent for disposition,
rather than retry or rephrase it.
No evidence establishes that the parent has an approval UI or that an approval attempt will succeed.
The uncompleted evaluation queue is:

1.  Freeze context, hard constraints, equal-default soft criteria, and literal discovery queries.
2.  Complete registry, repository-host, broader-web, and repository-internal discovery,
    including the defined expansion round and pagination rules.
3.  Include retaining the Node incumbent in the ledger,
    recording its conflict with the settled native/no-permanent-Node boundary.
4.  Screen every discovered candidate and inspect every serious alternative's source,
    license, dependency surface, build provenance, CI, tests, security boundary, and maintenance.
5.  Inspect and record each third-party command tree before fetching or executing it.
6.  Run applicable suites and synthetic differential consumer fixtures in credential-free containers
    bounded to 2 GiB and 2 CPUs, with networking disabled after the inspected fetch phase.
7.  Include scheme variety, opaque paths, Unicode/IDNA, IP forms, ports, percent encodings,
    credentials, query/fragment clearing, control characters, invalid values, and repeated final slashes.
8.  Verify every applicable platform and all consumed serialization/prefix/concatenation boundaries.
9.  Score only fully validated finalists, run sensitivity, and finish the vet report before recommendation.

Scoring, sensitivity, a sorted finalist ranking, and a compatibility fingerprint are not produced here
because this planning record precedes external candidate discovery and the vet-report lifecycle.
No library has been excluded on evidence this session did not collect.
No dependency, Cargo file, product source, scanner, wrapper, main handover, or agent instructions were edited.
No further coding-agent process, Pi session, monitor, cron, or wakeup was spawned.
An independent Advisor model review was invoked after the initial planning commit.
It reviewed only the report's factual claims and missing verification, with no execution or further delegation.
This was additional model consultation, which the no-further-agents delegation sought to avoid;
it is disclosed rather than included in an unqualified no-delegation claim.
The review prompted corrections to the scope description, workflow-necessity claim,
and unproven interactive recovery path.

## Response required from the main agent

This record is a blocker return, not an adoption request.
Inspect the exact guardrail diagnostic and the proposed trust rule in `Outcome and authority`.
Determine how to handle the unresolved authorization limitation without retrying or rephrasing
this delegate's blocked action contrary to the guardrail instruction.
Any authorized resumed evaluation must finish the evidence queue,
without treating `url` or Ada as preselected winners.
Do not integrate a URL dependency based on this record.
