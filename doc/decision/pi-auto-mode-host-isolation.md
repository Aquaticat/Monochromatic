# Keep auto-mode admission scoped to proposed tool operations

Accepted on 2026-10-15.
After independent no-tool reproductions of provider-switch and tree-navigation failures,
the user chose "Replace the integration (Recommended)" from the
[host-isolation proposal](../planning/pi-auto-mode-host-isolation.md).

Pi owns primary provider transport, retry, navigation, reload, session replacement, and disposal.
When automatic assessment evidence is unavailable, fall back to manual approval of the proposed tool group.
The user explicitly corrected the fallback on 2026-10-15.
Missing observation or assessment evidence alone must not permanently deny the operation.
Cancellation or a changed operation still invalidates approval for the old operation.
It must not turn an unrelated successful chat request into a policy-observation error.

Start operation admission before argument preparation in the native complete-group executor.
Retain exact preparation and execution identity, current policy and selected context,
the shared 15-second assessment budget, deterministic policy resolution, and scoped confirmation.
Source observation needed for authenticity is passive on primary requests;
its failure is retained and explained in the manual approval request at tool admission.
Do not invent source evidence or automatically approve tools after observation failure.

An established policy decision retains its prohibition and independent authorization requirements.
If those dependencies become stale during confirmation, reject that approval rather than opening a second dialog.
An operation outside the automatic inspection profile also falls back to manual review when bypass is disabled.
Manual Allow authorizes the exact prepared operation through the existing approval interface.
Stop or cancellation does not execute it.

Currentness belongs to each captured operation.
Native branch change invalidates old evidence;
future prompts and operations may capture the current branch without reopening an old permission.
Remove replaced session-admission and request-rejection paths instead of layering command-specific repairs.

The proposal's consumer matrix is required before activation.
The existing semantic cutoff, program profiles, bypass contract, and independent authorization rules remain unchanged.
