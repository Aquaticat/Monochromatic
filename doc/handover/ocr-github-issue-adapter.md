# OCR GitHub Issue adapter handover

## Status

The user selected the local adapter design for turning OpenCodeReview findings into GitHub Issues.
Implementation has not started.
No dependency has been added.

The user requested a design grilling before implementation.
Follow the `grilling` skill:
ask one decision question at a time,
provide a recommended answer,
and do not enact the design until the user confirms shared understanding.

Keep this handover current as grilling settles decisions and as implementation progresses.

## User requirements

The adapter must:

- use TypeScript;
- support an interactive mode;
- support a non-interactive mode;
- study `pnpm update -r -i --no-save` as the interactive UX precedent;
- prefer the libraries pnpm uses for that interaction;
- ask the user separately before adding each new workspace dependency;
- accept OCR output copied and pasted by the user;
- accept a JSONL file stored by OCR;
- implement the previously selected local-adapter architecture.

The exact meaning of "copypaste of OCR's output" is not settled.
It may mean OCR's human-readable terminal output,
the complete `--format json` object,
a JSON comment array,
or JSONL session records.
Resolve this during grilling rather than guessing.

## Settled grilling decisions

### Adapter responsibility

The user chose an ingest-only adapter.
It must not invoke OCR.
Users run OCR separately,
then provide its output through paste,
standard input,
or a supported file.

This removes OCR argument forwarding,
process signaling,
and OCR exit-code propagation from the adapter's scope.
The adapter still owns parsing,
validation,
interactive triage,
security quarantine,
deduplication,
and GitHub issue operations.

## Settled prior findings

The installed command is OpenCodeReview `v1.9.4`,
commit `f7344e79`.

OCR has no native regular GitHub Issue publisher.
Its Action calls pull request review and issue-comment APIs,
and `route_categories` only moves findings into the pull request summary.
The source audit and integration options are recorded in
[`doc/troubleshooting/open-code-review-github-issue-routing.md`][ocr-routing].

The user selected the local adapter over the private-intake Action and direct-public Action alternatives.
The intended boundary is a separate adapter command,
not an alias that shadows `ocr`,
not a write-capable OCR MCP tool,
and not SARIF.

## Security constraints

This repository is public.
[`SECURITY.md`](../../SECURITY.md) requires suspected vulnerabilities to use private vulnerability reporting
and forbids public security issues.

The prior recommendation therefore requires the publication boundary to fail closed:

- explicit `bug`,
  `performance`,
  `maintainability`,
  `test`,
  `style`,
  and `documentation` categories may become public candidates;
- `security`,
  `other`,
  missing metadata,
  `critical` findings,
  and secret or security signals must be quarantined;
- model-provided `thinking` must never be published;
- `existing_code` and `suggestion_code` require deliberate treatment
  because they can contain secrets or exploit details;
- model category alone is not a safe disclosure boundary;
- generated public issues should begin with `needs-triage`,
  not `ready-for-agent`;
- omission from a later OCR run must not automatically close an issue.

Grilling can revise the candidate policy only through an explicit user decision.
Do not silently weaken it during implementation.

## Verified technical evidence

The installed OCR binary supports:

```text
ocr review --format json --audience agent
```

A disposable empty repository verified that the installed artifact emits a top-level JSON object
with a `comments` array.
The source model defines comment fields including:

- `path`;
- `content`;
- `suggestion_code`;
- `existing_code`;
- `start_line`;
- `end_line`;
- `thinking`;
- `category`;
- `severity`.

OCR also persists sessions and exposes `ocr session comments --json`,
but the user's requested JSONL input must be inspected against actual OCR session files before its schema is designed.
Do not infer that session JSONL lines have the same shape as final review output.

A disposable classifier prototype under the agent scratch directory
verified the previously proposed fail-closed partition against synthetic findings.
That prototype is evidence only,
not production code and not part of this repository.

## Repository state and commits

The capability investigation and troubleshooting document landed in:

```text
cddac7bd6 docs(*): document OCR issue routing
```

At handover creation,
`main` and `origin/main` had advanced to:

```text
7a20add13 docs(kotlin-linter): record signing key rotation
```

The worktree was clean before this handover was created.

## Dependency approval gate

No new dependency may be added to the workspace until all of these steps occur for that dependency:

1. Inspect current pnpm source and package metadata to identify what pnpm uses for the relevant interaction.
2. Inspect this workspace for an existing dependency or utility that already meets the need.
3. Present the proposed dependency to the user with its role,
   alternatives,
   pros,
   cons,
   and personal ranking.
4. Wait for explicit approval for that dependency.
5. Add it through the pnpm catalog and package manifest using repository dependency policy.

Approval for one dependency does not approve another.
A transitive dependency does not require separate approval unless the implementation proposes making it direct.
Record each approval or rejection in this handover.

## Design tree still to grill

Resolve these branches one at a time,
in dependency order:

1. Command responsibility:
   settled as ingest-only.
   The adapter never launches OCR.
2. Publication timing:
   whether interactive mode confirms every issue,
   confirms a selected batch,
   or performs another review flow.
3. Input contracts:
   exact accepted pasted formats,
   JSON document shapes,
   OCR JSONL record types,
   framing,
   encoding,
   and malformed-input behavior.
4. Non-interactive authority:
   defaults,
   required flags,
   dry-run behavior,
   exit codes,
   and whether public mutation needs an explicit apply flag.
5. Security quarantine:
   where quarantined findings live,
   how users inspect them,
   and whether any route to private vulnerability reporting belongs in scope.
6. Repository selection:
   explicit `--repo`,
   Git remote inference,
   and behavior outside a Git checkout.
7. Issue rendering:
   title,
   body fields,
   source links,
   labels,
   omission of model reasoning,
   and handling of code excerpts.
8. Identity and lifecycle:
   fingerprint source,
   exact-marker lookup,
   update or reopen behavior,
   duplicate human issues,
   and no automatic closure.
9. Interactive mechanics:
   pnpm's prompt library and interaction model,
   terminal capabilities,
   cancellation,
   multi-select behavior,
   and accessibility.
10. Package interface:
    package location and name,
    binary name,
    configuration,
    and mise tasks.
11. Verification:
    parser fixtures,
    prompt interaction tests,
    mocked `gh` boundaries,
    disposable GitHub-side verification if authorized,
    and end-user CLI exercise.

## Immediate next action

Inspect OCR's persisted JSONL source schema rather than asking the user for discoverable facts.
Then ask the next dependent design question about accepted pasted input.
Ask one question only,
include the recommended answer with its pros and cons,
and wait for the user's response.
Do not inspect or add candidate dependencies until the relevant design branch makes their role concrete.

## Update history

- 2026-08-16:
  created before grilling,
  recording the selected local adapter,
  user requirements,
  dependency approval gate,
  prior evidence,
  and unresolved design tree.
- 2026-08-16:
  recorded the user's ingest-only decision and removed OCR process orchestration from scope.

[ocr-routing]: ../troubleshooting/open-code-review-github-issue-routing.md
