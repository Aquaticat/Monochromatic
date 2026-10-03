# Proposed command-result admission tightening

## Evidence and purpose

The persisted source-smoke preflight invoked `git diff` from `contract/lifecycle`.
The `cli-git` wrapper returned `require-root/not-at-root`,
exit code one.
The awaiting tool call completed normally,
so the orchestration incorrectly continued to metadata and dispatch.
The chained namespace-absence test did not run.
The source result and authoritative correction are retained in the private qualification repository.
This is a command-result admission gap,
not an upstream Git defect or permission to repeat the consumed source smoke.

## Immediate procedure

Check every prerequisite tool result's explicit success status before using its output or starting dependent work.
For `bash`,
require `exit_code === 0` unless the test predeclares a specific failure as its intended observation.
Awaiting a tool call or receiving `Promise.allSettled` fulfillment establishes response delivery,
not command success.
Keep unexpected failures and unexecuted suffixes separate from later successful measurements.
Successful exit alone does not establish that output belongs to the selected subject.
The syntax-probe preflight combined `mise which node` with a hash of another installation path;
substring presence matched that second path,
not the selected executable.
Resolve and hash the actual selected executable as a structured identity,
launch that canonical path,
and verify `process.execPath` before dependent work.
Post-exit identity measurements remain later evidence.
Similarly,
a tool read with visibly truncated output does not establish complete input coverage;
read the missing range before admission rather than claiming an earlier prerequisite succeeded.

## Proposed instruction replacement

The current `QIV` rule in `AGENTS.md` checks null/count probe scope,
cache,
harness,
and generator reach.
The proposal retains that intent and makes command status an explicit prerequisite:

```markdown
<!-- Proposed AGENTS.md fragment only, not applied. -->
QIV:
 Before trusting command output,
 nulls,
 or counts,
 require successful exit status;
 validate scope,
 cache,
 harness,
 and generator reach;
 list unexercised surfaces.
```

This replaces an existing rule instead of adding a competing rule.
It states the check at the decision boundary;
its tradeoff is requiring callers to inspect command-specific success representations.
`AGENTS.md` remains untouched under the standing restriction.
The proposed replacement is not accepted instruction text or dependent production work.
