---
name: troubleshooting-doc
description: >
  Use when writing or updating a TROUBLESHOOTING.<topic>.md file at the
  repo root to document an external tool's bug, quirk, surprising
  behaviour, or documentation gap. Triggers: user asks to "document this",
  "write it up", "add a troubleshooting entry"; or self-initiated after
  finishing an investigation. Encodes required sections, the source-trace
  rule, and the 5-constraint upstream-filing check that gates the draft
  GitHub issue at the end.
---

# Writing a TROUBLESHOOTING file

A TROUBLESHOOTING file is the durable artefact of investigating an
external tool. Future sessions and external readers must be able to
reproduce, verify, and act on every claim. The canonical worked example
is [TROUBLESHOOTING.resharp.md](../../../TROUBLESHOOTING.resharp.md);
match its shape unless the topic genuinely lacks a section.

## File naming

`TROUBLESHOOTING.<topic>.md` at the repo root. `<topic>` is kebab-case,
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
   AGENTS.md's broader source-citation rule.
4. **Verification**: version under test (with crates.io checksum,
   commit hash, or release tag), a runnable harness (shell commands or
   a minimal `Cargo.toml` + `main.rs` snippet), and at least two
   catalogues: patterns that work cleanly and patterns that fail. When
   multiple error variants exist, split the failing catalogue by
   variant so each failure mode is enumerated.
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
2. **Can upstream fix it?** Trace the depth: one-line change versus
   touching the algebraic or structural core.
3. **Are they supporting this use case?** Look for docs, examples,
   tests, or stated value propositions covering the combination.
4. **Will they likely fix it?** Check commit history and recent
   release deltas for movement in the relevant code path; cite the
   commits.
5. **Have we prototyped a minimal fix compatible with their
   architecture?** Speculative "suggested fix" prose without code, a
   correctness argument, or tests against a nontrivial set does not
   count.

The consumer-side workaround belongs at our boundary (e.g. a parse-time
guard in the consuming crate) where it solves the user-facing problem
regardless of upstream movement.

## Draft format (kept as reference, do not file as-is)

Even when you decide not to file, keep the draft so the rationale is
auditable and a future session can re-evaluate the five constraints if
upstream signal changes. Wrap the draft body in a `~~~md` fence so the
future filer can copy it cleanly. The draft contains: title, labels,
description with the same source trace as the "Root cause" section,
reproduction code from "Verification", and a "Suggested fix" naming
concrete code locations.

## Quality checks before declaring the doc done

- Every "the source does X" claim has a file path, line number, and
  code excerpt next to it.
- The harness reproduces the failure when run as written.
- Every workaround names a tradeoff.
- The 5-constraint subsection is present even when you decide to file,
  so the rationale is auditable.
- The draft issue is wrapped in a fenced block and marked "do not file
  as-is" unless all five constraints hold.
