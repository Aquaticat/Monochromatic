# GPT limitations

Documenting mistakes made by GPT during the 2026-06-29 oxlint-wrapper session,
so future sessions do not repeat the same failure pattern.

## Oxlint guidance augmentation session (2026-06-29)

**Goal:
** augment the oxlint wrapper so selected diagnostics receive better guidance:
`node(no-sync)` diagnostics for `existsSync` should recommend async access checks,
and `typescript(no-misused-spread)` should not print a separate wrapper `note:`
after oxlint already printed a `help:` line.

**Files involved:
**

- `packages/dev-script/task-util/src/oxlint-augment.ts`
- `packages/dev-script/task-util/src/oxlint-guidance.ts`
- `packages/dev-script/task-util/src/oxlint-augment.unit.test.ts`

### Mistakes

#### Missed the eager-commit rule

After the first verified logical unit,
 GPT reported completion without committing.
When challenged,
 it said no commit had been made because it does not commit unless
asked.
 That was wrong for this repository workflow.
 The session expectation was
eager commits after verified logical units.

Correct behavior:
 after targeted tests and lint passed,
 commit the scoped paths
immediately with an explicit pathspec.

#### Did not resolve the project instruction conflict early

The harness-provided project instruction block for `AGENTS.md` appeared empty,
and `AGENTS.md` in the checkout was empty.
 GPT accepted that at face value even
after repository behavior made it clear there was an operational rule about eager
commits.
 It should have treated the user's correction as authoritative and
adjusted immediately instead of defending the earlier no-commit behavior.

Correct behavior:
 when the user points to a missed repository rule,
 stop arguing,
apply the rule,
 and only then investigate why it was not visible in the current
context.

#### Made `oxlint-augment.ts` rule-specific

GPT initially put `node/no-sync`,
 `existsSync`,
 and `no-misused-spread` knowledge
inside `oxlint-augment.ts`.
 That made the output augmenter a rule-policy module,
not a generic formatter/parser.

Correct behavior:
 keep `oxlint-augment.ts` generic.
 Rule-specific text and match
conditions belong in guidance configuration.

#### Over-engineered the guidance model

GPT introduced several abstractions that were not needed:

- `GuidanceLineKind`
- `DiagnosticGuidance`
- `kind: 'help' | 'note'`
- `appendToExistingHelp`
- `helpText` and `noteText` object variants
- a separate `combinedHelp` style state in design discussion

The user repeatedly pointed out that the guidance is just a string to append.

Correct behavior:
 resolve a diagnostic to either a guidance string or a sentinel.
The augmenter carries only `activeGuidance: string | NO_RULE`.

#### Merged help and note generically instead of only addressing the reported case

When asked to combine the `help:` and `note:` output for the pasted
`no-misused-spread` diagnostic,
 GPT first changed the behavior for all guidance.
That would have altered unrelated diagnostics such as `no-misused-promises` and
`no-array-callback-reference` without the user asking for it.

Correct behavior:
 first preserve existing behavior outside the requested case.
Only generalize after the user asks for a simpler or broader architecture.

#### Preserved a separate `EXISTS_SYNC_ACCESS_HELP` export too long

GPT added and then kept `EXISTS_SYNC_ACCESS_HELP` as a separate exported constant
and imported it directly in the unit test.
 The user correctly pointed out that it
should be folded into `RULE_GUIDANCE`.

Correct behavior:
 one guidance registry should own all guidance text.
 Tests can
read guidance through that registry instead of importing one-off constants.

#### Used a side-table for context guards

GPT created a private side table for the `no-sync` `existsSync` condition.
 The
user correctly asked why context guards were not general.
 The final shape moved
the guard metadata next to the guidance entry:

```ts
'no-sync': {
  guidance: 'use `access` ...',
  headerIncludes: ['existsSync'],
}
```

Correct behavior:
 generic match metadata belongs on the guidance entry itself,
not in a parallel rule-specific table.

#### Fought the user's simplification instead of accepting it

Several times the user stated the simpler model directly:

- only the specific rule's output needed merging
- `oxlint-augment` should be generic
- no separate `activeGuidance` plus combined-help state
- no `helpText` and `noteText` types
- context guards should be general
- `EXISTS_SYNC_ACCESS_HELP` should live in `RULE_GUIDANCE`

GPT partially implemented each correction,
 but often left a neighboring
unnecessary abstraction in place until the next challenge.

Correct behavior:
 when the user identifies an over-abstraction,
 remove the whole
abstraction family,
 not only the exact symbol named by the user.

#### Claimed completion too early

GPT repeatedly said the work was done after passing tests,
 even while the design
still had issues the user immediately found.
 Verification covered behavior and
lint,
 but not the architecture requirement the user cared about.

Correct behavior:
 before declaring done,
 audit the result against the user's last
architectural constraint,
 not just command output.

#### Let max-lines and style failures drive churn

The first implementation added enough helper types and functions to trip
`eslint(max-lines)` in `oxlint-augment.ts`,
 plus style warnings.
 GPT then trimmed
locally instead of stepping back and asking why the design needed so much code.
The line-count failure was a symptom of over-engineering.

Correct behavior:
 when a small behavior change causes max-lines pressure,
 prefer
simplifying or extracting policy configuration over compressing the same design.

#### Confused output terminology during discussion

GPT used terms such as "current oxlint line" and talked about appending to an
existing `help:` line without first grounding that in the user's pasted output.
The output did include an oxlint `help:` line,
 but GPT's explanation was muddier
than necessary.

Correct behavior:
 quote the exact line from the user's example before describing
how the wrapper transforms it.

#### Committed an intermediate architecture that still needed correction

GPT committed `cb33cb17d` with a `helpText`/`noteText` style model.
 The user then
correctly pushed for further simplification.
 The later commit fixed it,
 but the
first commit captured an architecture that had not actually converged.

Correct behavior:
 eager commit does not mean careless commit.
 Commit after the
logical unit is both behaviorally verified and architecturally aligned with the
latest user constraint.

### Final expected pattern

For this family of changes,
 the stable pattern is:

- `oxlint-augment.ts` parses output and injects or appends resolved guidance.
- `oxlint-guidance.ts` owns rule-specific guidance text and generic match
  metadata.
- `resolveDiagnosticGuidance(...)` returns only `string | NO_DIAGNOSTIC_GUIDANCE`.
- If a diagnostic has an oxlint `help:` line,
   append the guidance string to that
  line.
- If no `help:` line appears before the diagnostic boundary,
   inject
  `help: <guidance>`.
- Tests should assert behavior through `RULE_GUIDANCE`,
   not through one-off
  exported constants.

### Lesson

GPT's main failure here was not inability to write code.
 It was failing to
maintain the user's desired level of simplicity.
 The model repeatedly introduced
classification objects,
 flags,
 side tables,
 and explanatory types when the task
needed one registry,
 one optional guard mechanism,
 and one string of guidance.
