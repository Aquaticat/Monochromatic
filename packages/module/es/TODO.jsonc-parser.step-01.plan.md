# JSONC parser – step 01 plan: robust string scanning

Date: 2025-10-24

Scope
- File: `packages/module/es/src/types/t object/t jsonc/f/t string hasQuotedSyntax jsonc/r s/p n/customParsers.ts`
- Add `scanQuotedString()` helper (iterative, escape-aware) at module scope.
- Replace the current string branch in `customParserForArray` primitive parsing to use `scanQuotedString`.
- No other logic changes (array loop, object parser, return contracts remain as-is for this step).

Rationale
- Current implementation uses `valueAfterQuote.match(/…/g)` which returns `string[]` without `.index`; accessing `.index` is erroneous.
- Collecting all matches with `/g` is unnecessary; only the first unescaped quote matters.
- Regex-based lookbehinds and complex patterns are harder to reason about and can be slower; an O(n) scanner is simpler and predictable.

Design
- `scanQuotedString(value)` assumes `value` starts with `"`.
- Scan forward; on each `"`, count the contiguous backslashes immediately before it. If the count is even, the quote terminates the string.
- Return `{ consumed: originalSliceIncludingQuotes, parsed: { value: originalSliceIncludingQuotes }, remaining: tailAfterClosingQuote }`.
- Preserve the original textual form (including quotes and escapes); do not interpret escapes at this stage.

Acceptance criteria
- Handles escaped quotes and backslash runs (e.g., `\\\"`).
- No usage of `match`, `matchAll`, or lookbehinds for termination.
- Leaves the rest of the parser unchanged; only the string branch is swapped.

Risks
- Off-by-one when slicing around the terminating quote. Mitigated by returning the slice `[0 .. closingIndex + 1)` and remaining at `[closingIndex + 1 .. end)`.
- Unterminated string must throw a concise error.

Files to touch
- Modify: `customParsers.ts`
