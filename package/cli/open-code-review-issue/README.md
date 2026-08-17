# @monochromatic-dev/cli-open-code-review-issue

Create GitHub Issues from validated OpenCodeReview structured output.
The command ingests review output only;
it never launches OpenCodeReview.

## Safety model

Issue creation is explicit and create-only.
The command does not update,
reopen,
close,
or deduplicate Issues from earlier runs.
A repeated input can create duplicates.

Security-classified findings are disclosure-gated.
An OpenCodeReview `security` category is not proof that public disclosure is safe.
Follow [`SECURITY.md`](../../../SECURITY.md) for unresolved suspected vulnerabilities.

Issue bodies retain OpenCodeReview content as active GitHub Markdown.
Headings,
HTML,
links,
mentions,
and fences can affect rendering or notifications.
Code-derived title fallbacks can expose source or secrets in Issue titles and notifications.
Review every preview before publication.

## Prerequisites

- Node.js supported by the workspace.
- GitHub CLI 2.97.0 or newer on `PATH`.
- An authenticated GitHub CLI session with access to the destination repository.
- OpenCodeReview structured JSON or JSONL produced separately.

## Accepted input

Every invocation requires exactly one positional named file containing:

- complete `ocr review --format json` or `ocr scan --format json` output;
- a comment array from `ocr session comments --json`;
- an OCR session JSONL transcript.

Named files must be strict UTF-8 without a byte-order mark.
`-` never means standard input.
Piped or redirected standard input is never an ingestion source.
Omitting the positional file is command misuse and exits with status `2` before any prompt.

## Modes

Exactly one mode is required.

### Interactive

```bash
open-code-review-issue --interactive ./review.json \
  --repo https://github.com/OWNER/NAME
```

Short form `-i` is available.
Interactive mode requires TTY standard input and TTY standard output.
It presents ordinary and security findings separately,
requires explicit disclosure decisions,
and confirms the final batch before mutation.

### Non-interactive preview

```bash
open-code-review-issue --non-interactive ./review.json \
  --repo https://github.com/OWNER/NAME
```

Preview mode performs no Issue creation and prints one exact JSON publication plan.

### Non-interactive publication

Create only when no security-gated finding exists:

```bash
open-code-review-issue --non-interactive --apply ./review.json \
  --repo https://github.com/OWNER/NAME
```

Create only non-security findings:

```bash
open-code-review-issue --non-interactive --apply --non-security-only ./review.json \
  --repo https://github.com/OWNER/NAME
```

Create all findings after asserting that every security finding is safe to disclose publicly:

```bash
open-code-review-issue --non-interactive --apply --all ./review.json \
  --repo https://github.com/OWNER/NAME
```

`--all` authorizes public disclosure.
Do not use it for an unresolved suspected vulnerability.

## Repository selection

`--repo` accepts only `https://github.com/OWNER/NAME`.
Without it,
the command infers a repository only when the working directory is exactly a Git worktree root.
A subdirectory or non-worktree directory requires `--repo`.

## Exit statuses

- `0` for success or clean pre-publication cancellation;
- `1` for validation,
  preflight,
  GitHub,
  partial-publication,
  or handled interruption failures;
- `2` for command invocation misuse;
- `130` for a forced second publication interrupt.

## Development

```bash
mise run //package/cli/open-code-review-issue:buildAndTest
mise run //package/cli/open-code-review-issue:lint
mise run //package/cli/open-code-review-issue:lint:types
```

The integration suite invokes the built binary with disposable fixtures and a fake `gh` executable.
Live verification is not a routine mise task because it mutates an explicitly authorized disposable repository.
