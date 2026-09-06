# agent-browser 0.36.0 assessment download timed out once and passed fresh-session controls

## Symptom

An initial invocation against `#export-assessment` in session `quality-explorer` emitted:

```text
✗ Operation timed out. The page may still be loading or the element may not exist.
```

The requested destination was `~/temp/agent/software-quality-assessment-test.txt`.
No downloaded assessment was observed after that invocation.
The page itself remained available and its browser error and console checks were empty.

## Root cause

Not established.
Fresh-session controls downloaded the application output without changing its export code.
The observed timeout therefore does not establish an application defect,
a data-URL limitation,
or a detached-anchor limitation.
No cause is inferred from the successful controls.

The inspected release was `v0.36.0`,
commit `eb05921bad874cd2a1b4fa5d1149f1ed26576cae`,
in the reference clone `~/temp/agent/agent-browser-quality-explorer-2026-09-06`.

[cli/src/native/actions.rs:6767][download] configures the destination,
subscribes to browser events,
then invokes the element click:

```rust
// cli/src/native/actions.rs:6767
mgr.set_download_behavior(download_dir_str).await?;

// cli/src/native/actions.rs:6770
let mut rx = mgr.client.subscribe();

// cli/src/native/actions.rs:6773
interaction::click(
```

The function handles a browser-reported completion at
[cli/src/native/actions.rs:6824][download]:

```rust
// cli/src/native/actions.rs:6824
match event.params.get("state").and_then(|v| v.as_str()) {
    Some("completed") => break,
```

This inspection and the completed downloads support using the native download action for this control.
They do not localize the initial timeout to a particular stage.

## Verification

Commands ran on 2026-09-06 using agent-browser 0.36.0 in a distinct session,
with launch flags kept consistent according to the
[launch-reset investigation](agent-browser-launch-option-reset.md).

### Reported failing catalog

The initial session invocation timed out with the exact diagnostic in `Symptom`.
Its cause was not reproduced or assigned.
The HTML's export implementation was left unchanged.

### Working catalog

```bash
# Independent browser session; preserve launch options throughout.
agent-browser --session quality-export --allow-file-access --pin-tab open \
  'file:///var/home/user/Monochromatic/doc/artifact/software-quality-scale.html'
agent-browser --session quality-export --allow-file-access --pin-tab click '[data-view="assess"]'
agent-browser --session quality-export --allow-file-access --pin-tab download \
  '#export-assessment' "$HOME/temp/agent/quality-export-first.txt"
agent-browser --session quality-export --allow-file-access --pin-tab set viewport 1440 900
agent-browser --session quality-export --allow-file-access --pin-tab fill \
  '#software-name' 'Export Ω & <example>'
agent-browser --session quality-export --allow-file-access --pin-tab fill \
  '#software-job' 'Keep notes safely'
agent-browser --session quality-export --allow-file-access --pin-tab fill \
  '#defects' 'Independent issue A; issue B. Literal <script> & “quotes”.'
agent-browser --session quality-export --allow-file-access --pin-tab download \
  '#export-assessment' "$HOME/temp/agent/quality-export-populated.txt"
```

Both native download commands completed and the files were read from disk.
The populated export retained the software name,
defining job,
Unicode,
literal markup-like text,
provisional result,
unresolved checks,
and method explanation.

A byte-for-byte comparison of the populated file with UTF-8 `assessmentText()` output returned `matches: true`.
The file measured 1246 bytes with SHA-256:

```text
0b9acafc3b2e433198aaf94253f27b416582e4eb33d22414593d1c046e219ed7
```

## Verified workarounds

No application workaround was needed.
An independent session supplied repeatable export evidence while preserving the main preview session.
Its tradeoff is starting with an empty assessment,
so the populated-state control entered its own notes before downloading.
This is a verification method,
not a proven remedy for the initial timeout.

## What does not work

Classifying the diagnostic as proof that detached anchors or data URLs cannot download is unsupported.
Both successful controls exercised that exact application implementation.
No export change was made to address an unassigned cause.

## Upstream filing artifact

Nothing to file.
No reproducible upstream defect was established and no issue or comment was sent.

### Upstream filing decision

1.  Upstream fault: not established by the isolated timeout.
2.  Fixability: no defect was localized,
    so no upstream change is proposed.
3.  Supported use: the inspected download handler and successful controls support this click-triggered download.
4.  Contribution policy: not material to an unlocalized event with no proposed contribution.
5.  Upstream direction: no claim is made.
    Duplicate investigation was not pursued after the successful controls because no bug is being filed or drafted.
6.  Prototype: not applicable;
    constraint 1 did not pass and the unchanged implementation completed real downloads.

The `.out-of-scope/` catalog was checked during this browser bridge investigation;
no agent-browser-specific exemption matched.
The initial timeout remains separate from the independently diagnosed launch-option reset.

[download]: https://github.com/vercel-labs/agent-browser/blob/eb05921bad874cd2a1b4fa5d1149f1ed26576cae/cli/src/native/actions.rs#L6722
