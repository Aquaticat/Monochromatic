# Code review skill philosophy

## Why the skill duplicates AGENTS.md rules

The code-review skill restates rules from `AGENTS.md` verbatim,
 enriched with severity annotations and bad/good code examples.
This is intentional,
 not accidental duplication.

`AGENTS.md` rules are loaded into every session as background context.
Background context fades as conversation length grows -- the agent remembers that rules exist
but loses precision on exactly what each rule requires.
When reviewing code,
 precision is the entire point:
 the difference between a BLOCKER and a NIT
is whether the agent can recall the exact pattern it should flag.

Restating the rules inside the skill means they are loaded a second time,
directly adjacent to the review instructions,
 at the moment the agent needs them most.
The token cost of this duplication is paid only during reviews,
 not during every session.

The alternative -- referencing `AGENTS.md` sections by name ("apply the rules from the TypeScript Standards section") --
assumes the agent will cross-reference accurately across documents under context pressure.
In practice it produces vague findings like "check your types" instead of
"line 42:
 missing explicit return type on `parseConfig`,
 flag as WARNING.
"

## Why the skill is large

At ~5,000 words the skill is larger than most.
This is a consequence of the duplication decision above and the number of review categories (16).

Splitting the examples into separate `references/` files would reduce the core file size
but add indirection for content that only loads during reviews anyway.
The skill *is* the reference material -- it is progressive disclosure by nature,
loaded on demand when a review is triggered.

If the skill grows beyond its current scope,
 the first split point is by language:
TypeScript patterns,
 CSS patterns,
 and markdown/documentation patterns
are independent enough to separate without losing coherence.

## Why severity annotations exist

Every bad/good example carries a severity annotation (`flag as BLOCKER`,
 `flag as WARNING`,
 `flag as NIT`).
Without these,
 the agent must judge severity from first principles on every finding,
which produces inconsistent output -- the same pattern flagged as WARNING in one review and NIT in the next.

The annotations encode project-specific severity decisions:

- Non-null assertions (`!`) are BLOCKER because `notNullishOrThrow` exists and is always available
- Missing explicit return types are WARNING,
   not NIT,
   because inference failures propagate silently
- Single-letter variables are WARNING in loops but exempt in math formulas

These are editorial decisions,
 not universal truths.
The annotations make the decisions explicit and repeatable.

## Why the output format is rigid

The structured output (BLOCKER/WARNING/NIT/NON-ACTIONABLE with file:
line references)
exists because unstructured review output is difficult to act on.

A finding like "there are some type safety concerns in the auth module"
requires the reader to locate the code,
 identify the specific issue,
 and decide what to do.
A finding like "src/`auth.ts`:
42 -- missing explicit return type on `parseConfig`,
 add `: Config`"
is immediately actionable.

The NON-ACTIONABLE category exists for real problems where the reviewer
cannot determine a specific fix.
Suppressing these would hide genuine concerns;
mixing them with actionable findings would dilute urgency.
Separating them preserves honesty without creating noise.

## What the description covers

The description is intentionally terse:
 "Review code.
"
The skill name `code-review` is the primary trigger signal,
and the skill is listed explicitly in the system prompt's available skills.
Users invoke it via `/code-review` or by asking to "review code.
"

A longer description with trigger phrases like "audit this PR" or "check code quality"
would help with fuzzy matching but risks false activation on tangentially related requests.
The current description matches the skill's actual scope without overreaching.
