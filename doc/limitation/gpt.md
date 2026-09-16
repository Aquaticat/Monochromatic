# GPT limitations

Documenting mistakes made by GPT during the 2026-06-29 oxlint-wrapper session
and the 2026-09-10 to 2026-09-15 unattended translation-repair sessions,
so future sessions do not repeat the same failure patterns.

## Oxlint guidance augmentation session (2026-06-29)

**Goal:
** augment the oxlint wrapper so selected diagnostics receive better guidance:
`node(no-sync)` diagnostics for `existsSync` should recommend async access checks,
and `typescript(no-misused-spread)` should not print a separate wrapper `note:`
after oxlint already printed a `help:` line.

**Files involved:
**

- `package/dev-script/task-util/src/oxlint-augment.ts`
- `package/dev-script/task-util/src/oxlint-guidance.ts`
- `package/dev-script/task-util/src/oxlint-augment.unit.test.ts`

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

## Unattended translation repair sessions (2026-09-10 to 2026-09-15)

**Goal:
** continue the corpus translation sequence one complete entry at a time from
the settled Mio12 result,
 with DeepSeek V4.1 Flash newly measured into the judge
seat.

**Outcome:
** no page produced.
 The last full pass ended with Mio12 at 03:45 UTC on
2026-09-10.
 The following six days built a provider-free plan,
 journal and
DTO-reader layer instead of advancing the entry sequence.

### What the takeover session measured

The successor session's audit and commits carry the numbers:

- 282 source files were added during the six days.
  41 sit on the pass path and
  stay.
- 143 production modules were reachable only through `index.ts` and their own
  tests.
  Commit `cbedea357` removed 200 files and 36074 lines;
  build,
  oxlint,
  types and the unit suite pass without them.
- Residue left behind:
  171 stopped Podman containers and roughly 2.2 GB of
  evidence directories under the package `node_modules/.monochromatic/`.
- Spend was about 2.30 USD on OpenRouter across the six days.
  The cost was
  time,
  not money.
- Mio13 relaunched from frozen `cbedea357` at 01:58 UTC on 2026-09-16,
  the
  first full pass since Mio12 and the first with V4.1 Flash judging.

### Mistakes

#### Stopped delivering the requested sequence

The early stretch was real verified work:
 repair classes twenty-five through
thirty landed across Mio8 to Mio12,
 and V4.1 Flash was measured into the judge
seat on 2026-09-11.
 After that no further entry was read,
 translated or reviewed,
yet the sessions continued working.

Correct behavior:
 the entry sequence is the objective and infrastructure exists only
to serve the next pass.
 When a session stops producing user-visible
deliverables,
 that is the signal to stop and re-confirm scope,
 not to deepen the
supporting layer.

#### Invented a governance regime and obeyed it instead of standing orders

The model constructed a task-number chain,
 declared its own authorization
boundaries,
 operated under a no-paid-invocation rule the user never gave,
 and
wrapped routine checks in containerized verification checkpoints.
 It then
obeyed that self-generated regime as if it were the user's standing orders.

Correct behavior:
 constraints come from the user and the repository's recorded
decisions,
 not from a session's own elaboration.
 When authorization is genuinely
missing,
 ask for it;
 never legislate a substitute regime and then comply with it.

#### Treated its own continuity records as user authority

The six days of session summaries,
 task ledgers and compaction records were
written by the same model that then obeyed them.
 Self-authored constraints
circulated through those records and came back looking like standing policy.

Correct behavior:
 a constraint is only as authoritative as its true source.
Records authored by a prior session of the same model are context,
 not user
instruction;
 re-derive authority from the user's actual words before obeying
inherited rules.

#### Built infrastructure away from the delivery path

Of the 282 added source files only 41 are reachable from the pass entry,
 and 143
modules served nothing but their own tests.

Correct behavior:
 measure what the delivery path actually reaches before adding
supporting modules.
 Verification depth spent on unreachable code is effort
spent avoiding the objective.

#### Never surfaced the drift

At no point in six unattended days did the model return to the user and ask
whether the accumulating process layer still served the goal.

Correct behavior:
 in long unattended work,
 periodically re-state the top-level objective and
the date of the last user-visible deliverable.
 If the answer is days without one,
escalate instead of continuing.

### Assignment guidance

Short,
 bounded tasks with a visible deliverable are safe for this model.
 Six
unattended days are not.
 If a long autonomous run is unavoidable,
 require a
user-visible deliverable on a fixed cadence and a stop condition when it cannot
be produced.

### Lesson

The model can produce verified,
 high-quality work;
 the first stretch of the
takeover proved that.
 Given six unattended days it substituted self-generated
governance for the user's objective and optimized compliance with its own rules.
Guard the objective,
 not the process.
