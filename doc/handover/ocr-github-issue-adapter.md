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

Copied and pasted input means one line of structured JSON entered through the interactive terminal prompt.
The adapter provides no multiline paste handling.
Users needing multiline input must write it to a file and pass that file path.
Human-readable terminal output and piped standard input are excluded.

## Settled grilling decisions

### Adapter responsibility

The user chose an ingest-only adapter.
It must not invoke OCR.
Users run OCR separately,
then provide its structured output through interactive paste or a supported named file.

This removes OCR argument forwarding,
process signaling,
and OCR exit-code propagation from the adapter's scope.
The adapter owns parsing,
validation,
interactive triage,
security quarantine,
and GitHub issue creation.
It is create-only.
It must not synthesize finding identities,
search for matching issues,
suppress duplicates,
update issues,
or reopen issues.
Repeated ingestion may create duplicate issues.

### Pasted input

The user chose structured JSON only for copied and pasted input.
The adapter must not parse OCR's human-readable terminal format.
This rule applies to interactive and non-interactive modes.
ANSI stripping and version-specific text parsing are out of scope.

The adapter accepts exactly these OCR-native structured shapes:

- complete `ocr review --format json` or `ocr scan --format json` result object;
- bare comment array from `ocr session comments --json`;
- raw OCR session JSONL transcript from a named file.

Interactive paste accepts a single-line JSON result object or comment array.
It has no multiline handling,
so users must provide JSONL transcripts and pretty-printed JSON through a named file.
A malformed or unsupported interactive paste reports its validation error and exits nonzero immediately.
The adapter must not keep the prompt open for correction or request another paste.
If any record inside an otherwise recognized input has invalid types or structure,
the adapter must reject the entire input before performing any GitHub operation.
It must not quarantine or skip malformed records and continue processing.
A structurally valid finding with absent classification metadata is not malformed under this rule;
the security policy still quarantines it.
Named files must be strict UTF-8 without a byte-order mark.
Malformed UTF-8 and a leading UTF-8 or UTF-16 byte-order mark reject the entire input before any GitHub operation.
The adapter must not perform lossy decoding or encoding auto-detection.

It must auto-detect among only these validated schemas.
It must not search arbitrary nested JSON for comment-like objects or accept individual comment fragments by accident.
All accepted shapes normalize into one internal finding collection before policy or publication logic runs.

### Mode selection

Mode selection must always be explicit.
Interactive mode uses `--interactive` with short form `-i`,
matching the explicit pnpm precedent.
Non-interactive mode requires `--non-interactive`.
Providing neither mode flag is an error rather than an inferred default.
Providing both contradictory mode flags is also an error.
Non-interactive mode must never prompt,
regardless of TTY detection.
A missing required non-interactive input or decision is an error rather than an invitation to prompt.
Without `--apply`,
non-interactive mode validates and previews proposed issue creation without GitHub mutations.
`--non-interactive --apply` explicitly authorizes creation.
`--apply` is invalid in interactive mode,
which uses its explicit post-selection confirmation as the mutation boundary.

No mode may consume piped standard input.
The user explicitly rejected pipes for this adapter.
Input uses one optional positional file path with conventional CLI defaults,
modified by the no-pipe rule:

- a positional path reads that named file in either mode;
- no path with `-i` opens the terminal paste flow;
- no path without `-i` is an error;
- `-` must not mean standard input.

The implementation must never inspect or read redirected or piped standard input as an ingestion source.
With a positional file,
it reads only that file.
Without a positional file,
non-interactive mode errors and interactive mode may read one line from the terminal TTY for its paste prompt.
Piped bytes are ignored rather than detected or consumed.
The implementation must not reopen `/dev/tty`,
`CONIN$`,
or another controlling-terminal device.

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

OCR also persists sessions and exposes `ocr session comments --json`.
Source inspection confirms that session JSONL is an event transcript,
not final review output repeated one object per line.
Findings are embedded in `comments` arrays on `review_item_done` and `review_item_reused` records.
A later checkpoint with the same fingerprint supersedes the earlier checkpoint,
and a later `review_item_failed` record for that fingerprint removes its findings.
The final `session_end` record can contain `run_manifest`;
a killed run may leave a partial transcript without `session_end`.
Other event types can contain prompts,
code,
tool calls,
and model output and must not be treated as findings.

A disposable classifier prototype under the agent scratch directory
verified the previously proposed fail-closed partition against synthetic findings.
That prototype is evidence only,
not production code and not part of this repository.

The pnpm `v11.8.0` source tag resolves to commit `93458600a8498412f85316d054e033319ba31ed6`.
Its `installing/commands/src/update/index.ts` implementation uses `checkbox` and `Separator`
from `@inquirer/prompts` for `pnpm update -i`.
The prompt groups choices with separators,
uses a terminal-dependent page size,
requires at least one choice,
shows explicit selection and cancellation instructions,
uses custom checked,
unchecked,
and cursor icons,
enables vim keybindings,
and catches Inquirer's `ExitPromptError` as a clean cancellation.
No dependency decision has been made from this evidence.

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
   interactive mode shows one final summary after selection,
   then requires an explicit yes or no before GitHub mutations.
   Empty input has no default and reprompts.
   The summary names the destination repository and each selected issue title.
   Every selected operation is creation.
   It reports quarantined findings only as a count and never displays their sensitive content.
3. Input contracts:
   pasted input is settled as structured JSON only,
   with no human-readable terminal parser.
   Accepted file shapes are the complete review or scan result object,
   `ocr session comments --json` comment array,
   and raw OCR session JSONL transcript.
   Interactive paste accepts one-line JSON for the result object or comment array.
   No mode may consume piped standard input.
   Non-interactive mode requires a named file.
   Interactive mode receives a named file or terminal paste.
   Source syntax is one optional positional file path.
   With no path,
   `-i` opens paste and non-interactive mode errors.
   `-` never means standard input.
   Redirected or piped standard input is never inspected or read as ingestion;
   interactive terminal prompts may read TTY standard input.
   Paste framing is settled as one line with no multiline handling.
   Users needing multiline input write a file and pass its path.
   An invalid interactive paste reports the error and exits nonzero without retrying.
   A malformed record rejects the entire input before any GitHub operation.
   Structurally valid findings with missing classification metadata remain security-quarantined.
   Named files require strict UTF-8 without any byte-order mark;
   malformed bytes or a byte-order mark reject the input before GitHub operations.
4. Non-interactive authority:
   mode selection always requires exactly one explicit flag:
   `--interactive` or `-i`,
   or `--non-interactive`.
   Neither or both is an error.
   `--non-interactive` without `--apply` validates and prints a preview without GitHub mutations.
   `--non-interactive --apply` explicitly authorizes issue creation.
   `--apply` is invalid with interactive mode,
   whose post-selection yes-or-no confirmation is its mutation boundary.
   Preview format and exit codes remain open.
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
   settled as create-only.
   The adapter has no synthetic identity,
   existing-issue lookup,
   duplicate suppression,
   update,
   reopen,
   or automatic closure behavior.
   Repeated ingestion may create duplicates.
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

Ask the next dependent design question about whether quarantined findings block publication of every finding
or only exclude the quarantined findings themselves.
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
- 2026-08-16:
  recorded structured-JSON-only pasted input and excluded human-readable OCR text parsing.
- 2026-08-16:
  recorded the three accepted OCR-native JSON shapes and rejection of arbitrary JSON fragments.
- 2026-08-16:
  recorded explicit `--interactive` or `-i` mode selection and non-interactive default behavior.
- 2026-08-16:
  excluded piped standard input from interactive mode and controlling-terminal reopening from implementation.
- 2026-08-16:
  expanded the pipe exclusion to every mode at the user's direction.
  Non-interactive ingestion now requires a named file.
- 2026-08-16:
  recorded positional file input,
  interactive no-path paste,
  non-interactive no-path failure,
  and rejection of `-` as a standard-input sentinel.
- 2026-08-16:
  recorded that the adapter never ingests redirected or piped standard input and ignores piped bytes.
- 2026-08-16:
  recorded the pnpm `v11.8.0` interactive-update source path and its use of `@inquirer/prompts` checkbox UI.
- 2026-08-16:
  recorded single-line interactive paste with no multiline handling;
  multiline JSON and JSONL require a named file.
- 2026-08-16:
  recorded that invalid interactive paste reports its error and exits nonzero without retrying.
- 2026-08-16:
  recorded atomic rejection before GitHub operations when any input record is malformed.
- 2026-08-16:
  recorded strict UTF-8 named files without byte-order-mark support or encoding auto-detection.
- 2026-08-16:
  recorded one post-selection summary and an explicit yes-or-no confirmation with no default.
- 2026-08-16:
  superseded the non-interactive default with required `--non-interactive` mode selection;
  neither or both mode flags is an error.
- 2026-08-16:
  reopened adapter-owned identity and deduplication after the user clarified that OCR supplies no issue identity.
- 2026-08-16:
  settled create-only publication with no synthetic identity,
  existing-issue lookup,
  duplicate suppression,
  updates,
  reopens,
  or automatic closure.
- 2026-08-16:
  settled non-interactive preview by default and required `--apply` for non-interactive issue creation.

[ocr-routing]: ../troubleshooting/open-code-review-github-issue-routing.md
