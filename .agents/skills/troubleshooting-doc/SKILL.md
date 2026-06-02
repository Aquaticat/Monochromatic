---
name: troubleshooting-doc
description: Use when writing or updating a docs/troubleshooting/<topic>.md file.
---

# Writing a TROUBLESHOOTING file

Fires when documenting an external tool's bug, quirk, surprising behaviour,
or documentation gap. Walk this skill end-to-end whenever the task involves
writing or updating a docs/troubleshooting/<topic>.md file.

Other surface phrases that should trigger the skill:
"document this", "write it up", "add a troubleshooting entry";
or self-initiated after finishing an investigation.

The skill encodes the required sections, the source-trace rule,
and the 5-constraint upstream-filing check that gates the draft GitHub
issue at the end.

A TROUBLESHOOTING file is the durable artefact of investigating an
external tool. Future sessions and external readers must be able to
reproduce, verify, and act on every claim. The canonical worked example
is [docs/troubleshooting/resharp.md](../../../docs/troubleshooting/resharp.md);
match its shape unless the topic genuinely lacks a section.

## File naming

`docs/troubleshooting/<topic>.md`. `<topic>` is kebab-case,
specific enough to distinguish from sibling docs (`bun-fetch-streaming`,
not `bun`). One bug or one cluster of related bugs per file.

## Required sections

1. **Title (`#`)**: one-line problem statement naming the tool, the
   version, the surface trigger, and the resulting failure mode. See
   the resharp doc's title for the shape.
2. **Symptom**: what the user sees. Quote error strings verbatim, list
   the surface-syntax patterns that trigger them, and note which error
   variant each pattern produces when more than one exists.
3. **Root cause**: the call chain that produces the failure, walked
   step by step. Every claim about source code cites
   `path/to/file.ext:LINE` and quotes the relevant code excerpt in a
   fenced block. Asserting "the parser rewrites X" without showing the
   rewrite is not allowed; this is the doc-writing specialisation of
   AGENTS.md's broader source-citation rule. If a previous reading or
   hypothesis was wrong, name it explicitly and quote the evidence
   that disproved it, so the next investigator does not re-derive the
   bad cause (the resharp doc's "earlier alternation-count reading was
   wrong" paragraph is the shape).
4. **Verification**: version under test (with crates.io checksum,
   commit hash, or release tag), a runnable harness (shell invocation
   of the affected binary, a minimal source-level program in the
   target tool's language, or both when each surfaces different
   information), and at least two catalogues: patterns that work
   cleanly and patterns that fail. When multiple error variants exist,
   split the failing catalogue by variant so each failure mode is
   enumerated.
5. **Verified workarounds**: each workaround is a runnable patch with
   its tradeoffs named (what semantics shift, what edge cases slip
   through). A workaround whose tradeoffs you have not stated is not
   verified.
6. **What does not work**: approaches you tried and rejected, with the
   reason each failed. Saves the next investigator from re-discovering
   dead ends.
7. **Draft upstream issue**: gated by the 5-constraint check below.

## The 5-constraint upstream-filing check

Before filing upstream, all five must hold. Write a "Why we do not file
this upstream" subsection that walks each constraint explicitly, even
when the answer is yes; the audit trail is the point. Default policy:
do not file. Every reported issue that does not satisfy all five is
treated as a publicity incident.

1. **Is it really upstream's fault?** Distinguish behaviour from
   wording from architectural restriction.
2. **Can upstream fix it?** This fails only when upstream genuinely
   cannot: an architectural or algebraic-core limitation that makes the
   fix impossible. A fix that is large, structural, or spread across
   several files still meets this constraint. Trace the depth to scope
   the prototype, not to decide pass/fail.
3. **Are they supporting this use case?** Look for docs, examples,
   tests, or stated value propositions covering the combination.
4. **Will they likely fix it?** This fails only when upstream is
   actively leaning no, shown by their docs (a documented won't-fix or
   stated non-goal) or direct communication (a maintainer declining a
   comparable request). Absence of signal is not a fail: no existing
   issue, no recent commits in the path, or silence all still meet this
   constraint. Check commit history and release deltas to inform the
   draft, not to gate it; cite what you find.
5. **Have we prototyped a minimal fix compatible with their
   architecture?** "Minimal" means the smallest set of changes that
   actually solves the issue; it does not constrain the fix's
   complexity. The minimal set may span several files or be intricate.
   Speculative "suggested fix" prose without code, a correctness
   argument, or tests against a nontrivial set does not count.

### Auto-prototype when constraints 1-4 hold or sorta-hold

When constraints 1-4 are all "yes" or "yes-with-a-soft-yes" (e.g. #4
reads "plausible" or "likely" rather than a definitive yes), do not
stop at "constraint 5: not yet" and report the gate failed. Prototype
the minimal fix yourself before declaring the audit done:

1. Clone the upstream source into a fresh, private, unpredictable
   directory under `/tmp/agent/`, created with `mktemp --directory`
   (or an equivalently private throwaway workspace under `/tmp/agent/`).
   Before first use, ensure the root exists with private permissions:
   `mkdir --parents /tmp/agent; chmod 700 /tmp/agent`.
   Never reuse an existing `/tmp/agent/<repo>` clone or any other
   pre-existing directory for this step.
2. Confirm the clone's `origin` URL and checked-out commit/tag match the
   upstream source cited in the doc before editing.
3. Apply the minimal set of changes that solves the cause identified in
   "Root cause": the smallest complete fix, not the simplest-looking
   one. Do not pad it with unrelated cleanup, and do not shrink it below
   what actually solves the issue because it looks large or spans
   several files.
4. Verify with the least-trusting harness that proves the change: prefer
   a targeted minimal program or existing reproduction harness over the
   upstream package's full test/build scripts. Run upstream scripts only
   inside a secret-free sandbox or container with no ambient credentials
   and no write access to this repository. Whatever you pick must surface
   the failure pre-patch and the success post-patch; "it compiles" is
   not verification.
5. Record the result, the verification command, and the verification
   output inline in the doc. For the diff itself: if it is small
   (single hunk, roughly under 20 lines including context), embed it
   inline in a fenced `diff` block. If it is larger (multiple hunks,
   multiple files, or long enough that inline embedding would crowd
   the doc), save it beside the doc as
   `docs/troubleshooting/<topic>.patch` (matching the doc's `<topic>`,
   prefix dropped since the directory names the family) and link to it
   from the doc with a relative path (the bare filename, same directory). The inline-vs-file
   threshold is about readability, not significance; either form
   satisfies constraint 5 as long as the patch is reproducible from
   what is recorded. With this recording in place, the audit ends
   with all five constraints "yes" and the draft becomes fileable.

The trigger is "constraints 1-4 hold or sorta-hold"; not "the fix is
already known to be small" and not "we are sure upstream will accept
this." A large or multi-file minimal set is still in scope: prototype
it. Sometimes the minimal fix is a one-line terminfo or config-table
change that costs less than the audit itself, but size is never the
gate, neither to skip the prototype nor to require it.

If prototyping reveals the change breaks the architectural core or
fails the tool's existing tests in unrelated places, re-evaluate
constraints 2 and 4 with the new evidence and revise the audit. A fix
that is merely large or intricate is not grounds to re-evaluate; only
an architectural blocker is. The prototype is also a probe; a failed
probe is useful data, not a wasted step.

AGENTS.md's "never modify files in cloned third-party repositories"
rule still applies to local workarounds (where editing source bypasses
the intended boundary). The only allowed exception here is a disposable
prototype clone created fresh for the upstream patch diff, after origin
verification, and verified without exposing credentials or this
repository to third-party scripts.

The consumer-side workaround belongs at our boundary (e.g. a parse-time
guard in the consuming crate) where it solves the user-facing problem
regardless of upstream movement.

## Check for an existing issue before filing

A duplicate report is itself a publicity incident, so before opening
anything new, search the upstream tracker for the same behaviour:
`gh search issues` and `gh search prs` across open and closed state,
with terms drawn from the symptom and the root cause, not just the tool
name. Constraint 4 already runs this search to gauge movement; this step
acts on a hit. Read the matching thread and its comments in full, not
just the title.

If a matching issue exists, do not open a second one. The contribution
becomes a comment on that issue, and the comment carries only what
genuinely advances the thread beyond what is already there: a sharper
root-cause trace, a reproduction they lack, affected-version data, the
prototyped fix and diff, or a workaround not yet mentioned. Diff your
findings against the existing thread before writing.

If nothing you have is absent from the thread, the comment is empty:
post nothing. A bare "+1", "me too", "still happens", or a subscribe is
not additive and is not a comment worth making. An empty comment is the
correct outcome when the thread already says everything you would, not a
gap to fill.

Record the duplicate in the doc: link the existing issue, and when there
is additive content keep the drafted comment the same way the draft
issue is kept (in a `~~~md` fence, ready to post). When there is nothing
to add, say so explicitly so a future session does not re-derive the
same empty comment.

## Draft format (kept as reference, do not file as-is)

Even when you decide not to file, keep the draft so the rationale is
auditable and a future session can re-evaluate the five constraints if
upstream signal changes. Wrap the draft body in a `~~~md` fence so the
future filer can copy it cleanly. The draft contains: title, labels,
description with the same source trace as the "Root cause" section,
reproduction code from "Verification", and a "Suggested fix" naming
concrete code locations.

When "Check for an existing issue" found a duplicate, the kept artefact
is the additive comment draft (or an explicit note that there was
nothing to add), not a new-issue draft presented as fileable.

## Quality checks before declaring the doc done

- Every "the source does X" claim has a file path, line number, and
  code excerpt next to it.
- The harness reproduces the failure when run as written.
- Every workaround names a tradeoff.
- The 5-constraint subsection is present even when you decide to file,
  so the rationale is auditable.
- The draft issue is wrapped in a fenced block and marked "do not file
  as-is" unless all five constraints hold.
- The upstream tracker was searched for a duplicate. If one exists, the
  doc links it and either keeps a fenced, additive-only comment draft or
  states explicitly there is nothing to add; it does not also present a
  new-issue draft as fileable.
- If constraints 1-4 held or sorta-held but constraint 5 read "not
  yet," the audit is incomplete; either run the auto-prototype step
  and record the result, or document why prototyping was attempted and
  abandoned. "Not yet" without that follow-up is the failure mode this
  skill explicitly catches.
