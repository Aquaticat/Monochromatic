# Agentic context management regex safety

Decision record for regex safety in the agentic context-management Pi extension plan.

Status:
 strategy chosen,
 exact dependency unchosen.
Date:
 2026-06-15.

## Context-fork answers

- The extension must support the user's regex shorthand path eventually.
- Regex input is model-supplied and may run during every provider request.
- The extension rewrites all eligible assistant and non-ACM tool result text,
  so regex mistakes can affect a broad request-time context surface.
- Open-source dependencies are preferred by repo policy.
- Exact package selection is not part of this decision.
  Phase 0 must run the repo's technology-selection process before naming or adding a dependency.

## Decision

Use a source-audited safe regex engine with documented linear-time behavior before enabling regex.
If no safe engine passes Phase 0 audit,
regex stays disabled and literal matching remains the only supported matcher until the decision is reopened.

## Rejected alternatives

### Abortable worker around JavaScript RegExp

Pros:
preserves JavaScript regex semantics and can terminate a hung match outside the main thread.

Rejection reason:
timeout behavior becomes part of every request-time context pass,
and adds worker lifecycle complexity.
A safe engine is a stronger default boundary.

### Restricted JavaScript regex syntax

Pros:
avoids adding a dependency and can reject known dangerous constructs.

Rejection reason:
hand-rolled regex safety is easy to under-specify,
and the implementation would need to prove the accepted subset cannot catastrophically backtrack.
That is riskier than source-auditing a purpose-built safe engine.

### Literal-only first

Pros:
safest first implementation and simplest matcher.

Rejection reason:
it does not support the user's shorthand example.
Literal matching remains the fallback when Phase 0 has not selected a safe regex engine,
not the chosen regex strategy.

## Follow-up required

Before implementation enables regex,
Phase 0 must:

- survey ready-to-use safe regex packages,
- source-audit the finalist and at least two serious alternatives,
- validate build and test commands for the finalist,
- document supported syntax differences from JavaScript `RegExp`,
- document that ACM adds no custom length,
  inspected-character,
  replacement-count,
  or active-rule caps.
