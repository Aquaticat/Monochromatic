---
name: advisor
description: Run a clean-room advisor pass that challenges an agent's assumptions, evidence, and completion claim. Use when the user says to call advisor, corrects a substantive claim, a task is multi-step or ambiguous, the agent is stuck, the approach is changing, or before declaring longer work done.
---

# Advisor

## Purpose

Use this skill as the fallback when the runtime has no native advisor tool. The goal is not self-approval. The goal is to interrupt momentum, re-read the evidence, and force a second-pass critique before the answer or implementation hardens.

## When to Run

Run an advisor pass:

- After a user correction of a substantive claim.
- Before committing to an approach on multi-step or ambiguous work.
- When errors repeat, results do not fit, or the approach is not converging.
- Before declaring longer work done.
- Before changing approach after gathering evidence.

For short reactive tasks where a tool result dictates the next action, an advisor pass is optional unless a correction, conflict, or completion claim is involved.

## Workflow

1. Capture the decision point:
   - User request.
   - Current intended answer or implementation.
   - Evidence already gathered, with paths, commands, docs, or URLs.
   - Assumptions that are not directly evidenced.
   - Verification already run and verification still missing.

2. If the current tool policy explicitly permits delegation, ask a non-editing reviewer to critique the decision point. The reviewer must not modify files. It should return blockers, missing evidence, incorrect assumptions, and a recommendation.

3. If delegation is not available, run the local advisor pass yourself:
   - Restate the claim or plan in one sentence.
   - Identify the weakest assumption.
   - Look for a primary source or local file that would falsify it.
   - Check whether the proposed response overstates evidence, skips a required measurement, ignores a newer user instruction, or expands beyond the request verb.
   - List concrete blockers before proceeding.

4. Resolve conflicts:
   - Primary-source evidence beats the advisor pass.
   - If the advisor pass conflicts with evidence already gathered, inspect the tie-breaking source before switching approach.
   - If evidence is still missing, gather it before answering unless the answer clearly labels the gap.

5. Before finalizing, record the result in the working notes or final response:
   - `Advisor pass: no blockers found.`
   - `Advisor pass found blockers: ...`

## Output Shape

Keep the pass concise:

```text
Advisor pass:
- Claim/plan: ...
- Weakest assumption: ...
- Evidence checked: ...
- Blockers: none | ...
- Action: proceed | gather more evidence | change approach
```

Do not paste long transcripts into the final answer. Surface only the outcome and any blocker that changed the work.
