# agent-browser 0.36.0 resets a local HTML preview when follow-up commands omit a launch option

## Symptom

On 2026-09-06,
opening the supplied software quality explorer with `--allow-file-access` succeeded:
the command reported the expected file URL and `Software Quality Scale` title.
A subsequent `get url`,
`snapshot`,
or `eval` command using the same session without that flag observed `about:blank`.
Running the commands consecutively in the same shell did not prevent the reset.

The relevant user-level configuration was:

```json
{
  "args": "--ozone-platform=wayland"
}
```

The application file was not responsible for this reset.
Repeating the launch flag preserved the same CDP target and the loaded document across subsequent commands.
No user browser profile or configuration was changed during diagnosis.

## Root cause

Source was cloned read-only for investigation with `gh repo clone vercel-labs/agent-browser`,
then checked out at the installed release tag `v0.36.0`,
commit `eb05921bad874cd2a1b4fa5d1149f1ed26576cae`.
The local reference clone is
`~/temp/agent/agent-browser-quality-explorer-2026-09-06`.
Source links in this document point to that immutable commit.

### A configured browser argument causes another launch configuration request

[cli/src/flags.rs:577][flags] loads `args` from the environment or configuration.
The absent file-access flag resolves to false at line 586:

```rust
// cli/src/flags.rs:577,586
args: env::var("AGENT_BROWSER_ARGS").ok().or(config.args),
allow_file_access: env_var_is_truthy("AGENT_BROWSER_ALLOW_FILE_ACCESS")
    || config.allow_file_access.unwrap_or(false),
```

[cli/src/main.rs:244][main] includes configured arguments in the launch-configuration condition:

```rust
// cli/src/main.rs:244,251
fn should_send_local_launch_config(flags: &Flags, command: &serde_json::Value) -> bool {
    (flags.headed
        || flags.cli_headed
        || flags.executable_path.is_some()
        || flags.profile.is_some()
        || flags.state.is_some()
        || flags.proxy.is_some()
        || flags.args.is_some()
```

At [cli/src/main.rs:1911][main],
that condition creates a launch command before executing the requested page command:

```rust
// cli/src/main.rs:1911
if should_send_local_launch_config(&flags, &cmd) {
    let mut launch_cmd = json!({
        "id": gen_id(),
        "action": "launch",
    });
```

### Omission changes the requested launch configuration

[cli/src/native/actions.rs:4367][actions] defaults a missing `allowFileAccess` to false:

```rust
// cli/src/native/actions.rs:4367
allow_file_access: cmd
    .get("allowFileAccess")
    .and_then(|v| v.as_bool())
    .unwrap_or(false),
```

The launch fingerprint includes that value at [cli/src/native/actions.rs:296][actions]:

```rust
// cli/src/native/actions.rs:296
opts.allow_file_access.hash(&mut h);
```

The first invocation requested true;
the follow-up invocation requested false.
The session name identifies the daemon but does not make this launch option persistent.

### A changed launch fingerprint closes the current browser

[cli/src/native/actions.rs:4466][actions] uses the changed fingerprint to request a relaunch:

```rust
// cli/src/native/actions.rs:4466
let hash_changed = state.launch_hash != Some(new_hash);
let storage_state_requires_clean_launch = storage_state_owned.is_some() && !is_external;
is_external != was_external
    || hash_changed
    || storage_state_requires_clean_launch
    || mgr.has_process_exited()
    || !mgr.is_connection_alive().await
```

The same path closes the existing browser at line 4487 and launches its replacement at line 4681:

```rust
// cli/src/native/actions.rs:4485
if had_browser_before_launch {
    let _ = auto_save_restore_state(state).await;
    close_current_browser(state).await?;
}
```

```rust
// cli/src/native/actions.rs:4681
state.browser = Some(BrowserManager::launch(launch_options, engine.as_deref()).await?);
```

The observed new browser target was blank.
This was not a successful navigation followed by selection of another pre-existing tab:
the launch fingerprint and target identifier changed together.

## Verification

Tested binary: `agent-browser 0.36.0`.
The release source identity is `v0.36.0` at
`eb05921bad874cd2a1b4fa5d1149f1ed26576cae`.
Commands require access to the host daemon socket;
the restricted command sandbox reported the socket directory as read-only.
The probes therefore ran through an approved host command invocation.

### Failing catalog

With the user-level `args` configuration shown in `Symptom`,
this invocation sequence reproduced the reset:

```bash
# Run from the repository, using an isolated reproduction session.
agent-browser --session quality-bridge-repro --allow-file-access --json open \
  'file:///var/home/user/Downloads/software_quality_scale_explorer%20(2).html'
agent-browser --session quality-bridge-repro --json get url
agent-browser --session quality-bridge-repro --json tab list
```

Measured output:

- Opening: URL was the supplied file;
  launch fingerprint was `9948502715194002109`;
  target was `260624BE45FCF182F5DA67133F6BF87F`.
- Reading without the flag: URL was `about:blank`;
  launch fingerprint was `12139463327302527752`.
- Listing tabs: the only page target was `BA875C6149BE5409342DCBDFD8BDF3DC`,
  with URL `about:blank`.

The page-command response reported `relaunchedBrowser: false` despite the changed launch fingerprint.
Do not use that field alone to verify browser continuity in this sequence.
The preliminary launch command and subsequent page command are distinct requests,
as shown by the source trace.

### Working catalog

```bash
# Repeat the effective launch options on every invocation.
agent-browser --session quality-bridge-repro --allow-file-access --json open \
  'file:///var/home/user/Downloads/software_quality_scale_explorer%20(2).html'
agent-browser --session quality-bridge-repro --allow-file-access --json get url
agent-browser --session quality-bridge-repro --allow-file-access --json get title
agent-browser --session quality-bridge-repro --allow-file-access --json tab list
agent-browser --session quality-bridge-repro --allow-file-access --json get url
```

Each page read retained the supplied URL and launch fingerprint `9948502715194002109`.
The tab list retained target `3E549932F55C1F84FE0989C1CB95E7F6` from the opening command.
The title read returned `Software Quality Scale`.

A separate session using consistent flags plus `--pin-tab` also retained the supplied URL.
Its subsequent `eval` returned the expected title and a measured button count of 40.
Pinning was not required for the successful unpinned control.

## Verified workarounds

Use the same launch flags for opening,
reading,
interaction,
and screenshots:

```bash
# Stable local preview session.
agent-browser --session quality-explorer --allow-file-access --pin-tab open \
  'file:///var/home/user/Downloads/software_quality_scale_explorer%20(2).html'
agent-browser --session quality-explorer --allow-file-access --pin-tab snapshot --interactive
```

The tradeoff is that each command must retain the launch options.
`--allow-file-access` continues enabling its requested Chromium capability for this isolated session.
`--pin-tab` adds strict tab binding but does not make unrelated launch settings persistent.

The upstream [configuration documentation][readme] also describes persistent configuration files.
A task-specific configuration is a possible alternative,
but it was not needed or tested for this incident.
Do not change the user's global browser configuration to repair a single preview workflow.

## What does not work

- Keeping only the same `--session` does not prevent a changed launch configuration.
- Chaining open and read in one shell does not preserve a flag omitted from the second command.
- Reopening the file and again dropping the flag reproduces the reset.
- Treating `about:blank` as evidence of broken application code misidentifies the failing boundary.
- [Issue 1299][issue-1299] is related symptom evidence,
  not a proven explanation for this incident.
  It reports macOS with versions 0.25.3 and 0.26.0 and a `--headed` trigger.
  This incident is Linux with version 0.36.0 and `--allow-file-access`.
  The installed source already includes a headed-option omission fix in `cli/src/main.rs:1916`.
  Applying that historical fix would not address the measured file-access change.

## Upstream filing artifact

No issue or comment was sent.
No fileable new-issue draft is retained:
this investigation corrected the invocation's changing launch configuration,
and does not establish an upstream obligation to make every launch flag sticky.

### Upstream filing decision

1.  Upstream fault: not established.
    The invocation requested different effective launch settings.
    `README.md:1088` explicitly documents persistent defaults as an alternative to repeating command flags.
2.  Upstream fixability: a persistence change is conceivable,
    but its intended semantics were not established and no change is proposed.
3.  Supported use case: local browser automation and configured launch options are documented.
    Persistence of this omitted flag is not promised by the inspected README or source.
4.  Contribution policy: inspected README and `.github/` at the release tag.
    The checkout has no `CONTRIBUTING.md` or issue templates;
    no AI contribution ban was found in those inspected files.
    No contribution is proposed.
5.  Upstream direction: tracker searches found related issue 1299,
    whose body and comments were read in full.
    Searches used `allow-file-access relaunch`,
    `launch flags about:blank`,
    `relaunch flags`,
    `about:blank config`,
    and `launchHash` across issue and pull-request searches.
    No identical file-access incident was identified from those searches.
6.  Prototype: not warranted for this consumer invocation correction.
    Constraint 1 did not pass,
    so the skill's automatic upstream prototype requirement does not apply.

The repository `.out-of-scope/` catalog was checked;
no agent-browser-specific exemption matched.
The related macOS report remains a separate incident until its input and version boundaries match.

[flags]: https://github.com/vercel-labs/agent-browser/blob/eb05921bad874cd2a1b4fa5d1149f1ed26576cae/cli/src/flags.rs#L577
[main]: https://github.com/vercel-labs/agent-browser/blob/eb05921bad874cd2a1b4fa5d1149f1ed26576cae/cli/src/main.rs#L244
[actions]: https://github.com/vercel-labs/agent-browser/blob/eb05921bad874cd2a1b4fa5d1149f1ed26576cae/cli/src/native/actions.rs#L296
[readme]: https://github.com/vercel-labs/agent-browser/blob/eb05921bad874cd2a1b4fa5d1149f1ed26576cae/README.md#L1086
[issue-1299]: https://github.com/vercel-labs/agent-browser/issues/1299
