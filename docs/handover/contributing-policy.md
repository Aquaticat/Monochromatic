# Contributing policy decision log

Living record of the repo's contribution-policy work,
updated across sessions.
Tracks what we settled, why, what stays open, and the planned shape of the deliverable.

## Status

Planning.
`CONTRIBUTING.md` not yet written.
Major decisions are settled (below); a few practical tensions stay open.

## Goal

Write a root `CONTRIBUTING.md` in the spirit of [xkcd 810 "Constructive"][xkcd-810].
The comic imagines defeating spam by forcing every applicant to contribute constructively;
its [comment thread][explain-810] is the rebuttal,
years of readers noticing the gate is gameable.
The deliverable keeps the comic's dream and removes the part that broke.

## The spine

810's gate failed because its rating layer was a crowd,
and crowds are gameable
(vote-rigging, sockpuppets, and now LLM-cheap "looks helpful" output).
Monochromatic replaces the gameable crowd with two things a crowd cannot be:

- A machine: it builds, types check, lint sits at zero, tests hold. Objective, unfakeable.
- A single accountable judge: the maintainer's judgment of project fit,
  in the maintainer's words, "does this aquatic cats."

One trusted judge plus a machine is the configuration the comment thread kept reaching for
and never named.

## Decisions

### Voice and register

Straight professional prose, manifesto-forward, genuinely hoping for contributions.

### Placement

Root `CONTRIBUTING.md`.
This contradicts the `DPL` rule
(root holds only README, SECURITY, AGENTS, CLAUDE, LICENSES),
so the rulebook gets updated to bless it:
add `CONTRIBUTING.md` to the `DPL` allowed-root-files list in `AGENTS.md`,
then regenerate `CLAUDE.md` through file-enforcer (`WC2`).

### Depth

Thin frame plus pointers to [`AGENTS.md`](../../AGENTS.md), [`README.md`](../../README.md),
and [`SECURITY.md`](../../SECURITY.md).
The file does not restate their mechanics.

### Bots and AI

Welcome, no disclosure required.
Maps onto the existing `ready-for-agent` label, which already presumes agent work.
A contribution is judged on its result, not its author's nature.

### Approval workflow

No PR without an approved issue.
An issue opens as `needs-triage`;
the maintainer approves it by applying `ready-for-agent` or `ready-for-human`,
or closes the door with `wontfix` or `needs-info`.
A PR implements an approved issue.
Merge needs both gates: `mise run validate` green, and maintainer review.
Label vocabulary lives in [`docs/agents/triage-labels.md`](../agents/triage-labels.md).

### Contribution size

Sized at the gate, no numeric cap.
One approved vertical-slice issue per PR.
Work too big for one slice is split into several approved issues before any code.
Size is decided when the issue earns its label, not argued at the PR.

### Tiny-fix carve-out

A tiny fix may open a PR directly with no issue.
Tiny is defined exactly: one typo, or one doc paragraph, or one comment for one line of code.

### Threat model stays out of the public doc

`CONTRIBUTING.md` states rules only.
It does not enumerate the attacks,
because naming the games in the contributor-facing doc invites them.
The threat-model reasoning is recorded in this handover instead (see below).

### Maintainer obligation

Stay warmly inviting.
Do not advertise "no guaranteed response" now;
flip to an asymmetric stance only if contribution volume actually becomes a problem.

### Test-quality bar

Mutation testing and fuzzing are contributor requirements, not maintainer-only tools.
External contributors run them
and are held to at least the bar the maintainer holds for themselves.
Rationale, in the maintainer's words: no point holding external contributors to a lower bar.
Background: [`docs/decisions/mutation-testing.md`](../decisions/mutation-testing.md).

### Provenance warranty

Include a warranty line:
by contributing, you warrant you have the right to contribute the work under the repo's license.
Code is LGPL-3.0-or-later; non-code is CC-BY-SA-4.0.
This anchors the no-disclosure bot stance to an accountable submitter under copyleft.

### Footnote

Credit [xkcd 810 "Constructive"][xkcd-810] as the inspiration.

## Threat model (kept here, deliberately not in CONTRIBUTING.md)

Each item is an attack the comic or its comment thread named, paired with this repo's answer.

- Plausible slop ("easier to look constructive than be it"):
  the machine gate is objective, so plausibility earns nothing.
- Tests that look like tests but assert nothing:
  Stryker mutation testing and fast-check fuzzing require that a test kill mutants
  and survive generated input, not merely execute lines.
- Gameable crowd rating:
  there is no crowd, only one machine and one named judge, neither sockpuppetable.
- Flood or denial-of-service against the gate (infinite LLM output, finite evaluation):
  the governing principle is that the gate must cost the contributor more than the maintainer.
  The contributor runs validate and supplies the green;
  an issue must earn a label before anyone writes code;
  `needs-triage` to `wontfix` is a near-free reject.
- "I did everything right and got rejected on taste":
  approval-before-PR fires the taste gate before the work, not at PR time.
- Provenance under copyleft:
  whoever opens the PR is accountable for license and provenance, however the code was generated.

## Open items and tensions

- Test-quality enforceability:
  the mutation-testing decision doc describes mutation runs as opt-in and expensive
  (Podman, baked runtime images, one Stryker session per source file).
  Requiring every external contributor to run them needs a practical path:
  what exactly contributors run, whether CI runs it,
  and what "the same bar I hold myself to" means
  when the maintainer's own mutation runs are opt-in.
  Resolve before `CONTRIBUTING.md` claims it.
- Visibility of this doc:
  it is committed, so it is repo-visible.
  The threat model is mild to expose, but if exposure is unwanted, rename to `.local.md`.
- Sequencing:
  the DPL bless and the `CLAUDE.md` regen happen alongside writing `CONTRIBUTING.md`, on "go."

## Planned CONTRIBUTING.md outline

- Opening: the one idea (keep 810's dream, delete the crowd), stated without naming attacks.
- Same door for bots and humans, no disclosure.
- How to contribute: open an issue, wait for a `ready-*` label, PR against it, both gates must pass.
- Size: one approved slice per PR, big work split into approved issues first.
- Tiny-fix carve-out, defined exactly.
- The bar: validates clean, lint at zero, mutation and fuzz survivable tests, TSDoc,
  docs placement, Conventional Commits, no AI-attribution trailers; full rules in `AGENTS.md`.
- Issues count as contributions.
- Pointers: `AGENTS.md`, `README.md`, `SECURITY.md`.
- License and warranty line.
- Footnote crediting xkcd 810.

## Files in scope

- `CONTRIBUTING.md`: new, repo root.
- `AGENTS.md`: add `CONTRIBUTING.md` to the `DPL` allowed-root-files list.
- `CLAUDE.md`: regenerate from `AGENTS.md` via file-enforcer.
- `docs/handover/contributing-policy.md`: this log.

## Changelog

- 2026-06-26:
  decision log created.
  Captured voice, placement, depth, bot stance, approval workflow, size,
  tiny-fix carve-out, rules-only public doc, warm maintainer obligation,
  mutation and fuzz contributor bar, provenance warranty, footnote.

[xkcd-810]: https://xkcd.com/810/
[explain-810]: https://www.explainxkcd.com/wiki/index.php/810:_Constructive
