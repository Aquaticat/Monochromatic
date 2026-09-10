# Reassessing the verse remedy

## Correction

The owner wrote:
"No,
the best way to fix that defect isn't red/green guards and a publication test."
This does not select another mechanism.
The claim that the class-twenty-nine guard was the right remedy is withdrawn.
Tests demonstrate behavior;
they do not establish that the behavior is the right intervention.

`Mio11` was stopped by sending SIGTERM to its verified pass pid `1653981` at 02:18 UTC.
The supervisor exited after 150 seconds.
No further source edits or paid launches followed the correction.
The guard remains committed but provisional,
not an accepted shipping remedy.
No automatic reversal is claimed or performed.

## What the evidence establishes

- Mio10's source-only closing poem has five explicit Markdown breaks.
  Its accepted translation and consolidated text have zero.
- The stored reply survey includes a break-preserving poem proposal as well as flat proposals.
  A producer was capable of preserving the structure;
  the existence of that reply alone does not establish its stage or eligibility.
- The artifact's slice-17 consolidation has `rewrapped: false`.
  Its base,
  proposed and shipped polish texts are the same flat text.
  The final wrapper is not where this selected text lost its breaks.
- The isolated source poem returns false from `isLineStructured`.
  That predicate requires five blank-separated blocks.
  The effective production flag also inherits from the enclosing chunk;
  that flag is not recorded in the settled artifact and must not be inferred from the isolated test.
- `translate-wire.ts`,
  `translate-selection-sheet.ts` and `consolidate-wire.ts` make verse instructions conditional on that flag.
  Their verse language refers to output lines,
  not explicitly to rendered Markdown breaks.
- The new `source-only-breaks.ts` rejects missing breaks after generation.
  It leaves those upstream instructions and their source representation unchanged.

Evidence:
`~/temp/agent/Mio10-poem-replies-20260910.out`,
`~/temp/agent/Mio10-poem-decisions-20260910.out`,
`~/temp/agent/Mio10-20260910/artifacts/Mio.json`,
and the source files under `package/module/translation-repair/src/`.
Raw provider payloads remain private.
The settled run's `slice-cache/Mio` directory is absent;
that is not evidence of an absent earlier stage or an absent inherited flag.

## Recommended direction

Repair the existing generation and judging contract around rendered structure.
Parsed explicit breaks should be source facts visible to writers and judges even inside one block.
The contract must distinguish a rendered break from a physical newline.
Consolidation must receive the same fact rather than reinterpreting the source from another rule.
The guard and publication test can verify this remedy,
but cannot substitute for it.

Before implementation,
recover the effective source-structure fact and trace the break-preserving proposal to its stage and ballots.
Then compare a targeted contract change against the current behavior on the same passage,
without buying another full-entry pass merely to test a rejection rule.

### Improve the existing rendered-structure contract

- Pros:
  changes what writers produce and judges select;
  uses the existing verse-handling path.
- Cons:
  remains model-mediated;
  requires measurement through selection rather than a prompt-string assertion.

### Make explicit breaks visible in the model-facing representation

- Pros:
  a canonical visible spelling such as `<br/>` avoids relying on trailing spaces.
- Cons:
  requires careful scoping and renderer verification;
  changing the source presentation alone does not ensure judges preserve it.
- Relationship:
  a possible supporting part of the recommended contract repair,
  not an alternative to it.

### Move syntax ownership into structured translation units

- Pros:
  keeps authored syntax outside unrestricted prose generation.
- Cons:
  changes the translation interface and handling of legitimate English expansion;
  the current incident does not yet justify that scope.

Ranking for intervention priority:
repair the existing contract first,
measure visible break representation as a supporting change next,
and consider structured units only if that evidence establishes the need.
The first precedes representation changes because both writers and selectors currently need the rendered distinction.
Representation precedes structured units because it can retain the existing translation interface.
These are complementary interventions,
not mutually exclusive user choices.

## Independent review

A fresh Advisor review on `openai-codex/gpt-5.6-terra` agrees that the guard does not establish the best remedy.
The earlier review answered whether a narrowly scoped guard fit existing authority,
not whether it was the best intervention.
Its agreement was incorrectly promoted into confidence about remedy selection.
The inherited production flag remains an evidence gap despite that review's initial inference.

## Proposed instruction amendment

Replace `TC2` in the worktree's `AGENTS.md`,
rather than add a duplicate testing rule:

> TC2:
> Passing tests prove neither completeness nor remedy choice.
> Prefer preventing the failure to rejecting its output;
> compare test names with implementation branches.

This is a proposal,
not an applied instruction change.
The existing guard-demonstration requirement in `GFP` remains unchanged.

## Cost and next action

Stopped Mio11 logged 0.003006791 USD on OpenRouter,
0.00038817 USD on Bedrock,
and six Synthetic calls with no per-call price.
These are logged amounts,
not a post-cancellation balance reconciliation;
in-flight usage may not have been reported.
The daily helper ran into `~/temp/agent/Mio11-costs-stopped-20260910.out`.

No pass is running.
Resolve the upstream remedy before altering source again or relaunching Mio.
The page-reading queue and readiness claim remain blocked.
