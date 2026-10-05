# Claude Code 2.1.289 subagent worktree isolation fails because the `cctt` `WorktreeCreate` hook prints no path

## Status

Diagnosed on 2026-10-05.
The cause is this repository's hook registration, not a Claude Code defect.
A workaround is in use;
the fix is proposed in "Proposed fix" and not applied.

## Symptom

Launching a subagent with the Agent tool's `isolation: "worktree"` option fails before the agent starts.
Claude Code 2.1.289 returns this error to the calling agent, verbatim:

```text
WorktreeCreate hook failed: hook succeeded but returned no worktree path (command: echo the path to stdout; http/callback: return hookSpecificOutput.worktreePath)
```

Two launches in one session failed identically.
Subagents launched without `isolation` in the same message started normally.
An earlier session hit the same failure and recorded it in `doc/handover/slint-ide-0x.md`.

## Root cause

A command hook registered on `WorktreeCreate` replaces Claude Code's own worktree creation
and must print the new worktree's path.
The Claude Code hooks reference
(fetched 2026-10-05 from `https://code.claude.com/docs/en/hooks.md`) says:

```text
A command hook that creates a worktree must print the worktree's root directory path to stdout.
Claude Code uses this path for subsequent tool calls in that worktree.

If the hook exits with a non-zero code or prints no path, worktree creation fails and Claude Code shows Claude the error.
```

The local settings register the terminal-title hook `cctt` on that event.
`.claude/settings.local.json:764` (the file is ignored, `.gitignore:125`):

```json
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cctt"
          }
```

That registration follows the plugin's own instructions.
`package/claude-code-plugin/terminal-title/README.md:131`:

```json
    "WorktreeCreate": [{ "type": "command", "command": "cctt" }],
```

`cctt` only sets a terminal title for the event and never creates a worktree.
`package/claude-code-plugin/source/src/handler/terminal-title/index.ts:158`:

```ts
  if (hookEvent.hook_event_name === 'WorktreeCreate')
    return `Created worktree: ${hookEvent.name}`;
```

It writes nothing to stdout by design.
`package/claude-code-plugin/source/src/handler/terminal-title/index.ts:198`:

```ts
 Output is `void`: the handler writes its OSC sequence to `/dev/tty` and emits no stdout.
 */
type TerminalTitleOutput = void;
```

So the hook exits 0 with empty stdout,
Claude Code has no path,
and worktree creation fails.

The repository's hook types already state the contract the registration breaks.
`package/claude-code-plugin/hook-type/src/events-misc.ts:136`:

```ts
 Input for `WorktreeCreate` hooks.
 Fires when a worktree is being created.
 Replaces default git worktree behavior when configured.
```

`package/claude-code-plugin/hook-type/src/events-misc.ts:149`:

```ts
/* WorktreeCreate output is the absolute path printed to stdout. No JSON decision model. */
```

### Related observations, not causes

- The fetched reference lists the event's input fields as `worktree_name`,
  `base_path`,
  and `branch`.
  `package/claude-code-plugin/hook-type/src/events-misc.ts:146` declares `name: string` instead,
  and the title handler reads `hookEvent.name`.
  The field names were not probed against a live event in this session.
- `.claude/settings.local.json:774` registers `cctt` on `WorktreeRemove` too.
  The fetched reference says a command hook on that event
  "should delete its directory and exit 0".
  `cctt` deletes nothing.
  Whether that leaves worktrees behind was not tested here,
  because creation never succeeded.

## Verification

Versions:
Claude Code 2.1.289 (`claude --version`),
Node v26.10.0,
repository commit `a21467f5e`.

Harness, run from the repository root.
It feeds `cctt` a `WorktreeCreate` event and measures stdout:

```sh
# doc/troubleshooting/claude-code-worktree-create-hook-no-path.md
printf '%s' '{"session_id":"probe","transcript_path":"/nonexistent/probe.jsonl","cwd":"/var/home/user/Monochromatic","hook_event_name":"WorktreeCreate","name":"probe-worktree"}' \
  | cctt | wc --bytes
```

Result on 2026-10-05:
exit status 0,
0 bytes on stdout,
0 bytes on stderr.

### Works

- Agent tool launches without `isolation`
  (five launched in the diagnosing session).
- `git worktree add -b <branch> .claude/worktrees/<name> main` through the repository's Git wrapper,
  then a package gate run from inside that worktree
  (`GIT_POLICY_NATIVE_IMAGE_TAG=command-parser mise run //package/git-policy/cli:native:test:container`
  passed 9 tests and Clippy in `.claude/worktrees/cli-git-native-command-parser`).

### Fails

- Agent tool launches with `isolation: "worktree"`:
  two of two failed with the quoted error.

## Verified workarounds

### Create the worktree by hand and pin the subagent to it

```sh
# doc/troubleshooting/claude-code-worktree-create-hook-no-path.md
cd -- /var/home/user/Monochromatic && git worktree add -b <branch> .claude/worktrees/<name> main
```

A worktree created from the main checkout receives no ignored state:
`package/git-policy/cli/README.md` documents that main worktrees bypass ignored-state synchronization
"even when they create a linked worktree".
The first commit in the new worktree therefore failed with this policy event, verbatim:

```text
{"schemaVersion":1,"sequence":0,"type":"engine-failure","code":"plugin-threw","message":"Forbidden-strings scanner executable could not be started.","trigger":"pre-forward","policyId":"security/forbidden-strings"}
```

Provision the worktree before the subagent's first commit:

```sh
# doc/troubleshooting/claude-code-worktree-create-hook-no-path.md
mkdir --parents .claude/worktrees/<name>/package/cli/forbidden-strings/target/release
cp --reflink=auto --preserve=mode package/cli/forbidden-strings/target/release/forbidden-strings \
  .claude/worktrees/<name>/package/cli/forbidden-strings/target/release/forbidden-strings
cd -- /var/home/user/Monochromatic/.claude/worktrees/<name> && mise run prepare:pnpm:install
```

After that the same commit succeeded and auto-push published the branch.
`prepare:pnpm:install` took 1.5 seconds against the warm store and changed no tracked file.

Then launch the subagent without `isolation` and tell it the worktree root and branch.

Tradeoffs:

- The copied scanner is the main checkout's build as of the copy,
  not a build of the worktree's own scanner source.

- The subagent's session still starts in the main checkout.
  It must pin every shell command to the worktree and use absolute paths under it;
  a path into the main checkout silently edits the wrong tree.
- Nothing removes the worktree or its branch when the subagent finishes.
- Auto-push publishes the branch.
- `.claude/` is ignored,
  so the worktree does not appear in the main checkout's status;
  it also means nothing reminds a later session that it exists.
  `git worktree list` shows it.

## What does not work

- Retrying the isolated launch:
  the hook is deterministic,
  so the second attempt failed the same way.
- Expecting `cctt` to pass the event through to Claude Code's default behavior:
  a registered command hook replaces the default,
  it does not decorate it.

## Proposed fix

Not applied:
`.claude/settings.local.json` is the user's local configuration,
and the README change alters what the plugin tells every installer to register.

- Remove the `WorktreeCreate` entry from `.claude/settings.local.json`
  and from the settings example in `package/claude-code-plugin/terminal-title/README.md`,
  along with the `WorktreeCreate` title in that README's event list.
- Decide `WorktreeRemove` separately after probing whether a non-deleting hook leaves worktrees behind.
- Alternative that keeps the title:
  make the handler create the worktree and print its path.
  That moves worktree policy (location, branch naming, ignored-state copying) into a title plugin,
  which is a larger ownership change than removing two registrations.

## Upstream filing decision

`.out-of-scope/claude-code-upstream-bugs.md` exempts Claude Code defects from upstream tracking.
It does not decide this case,
because this is not an upstream defect.

1.  Is it upstream's fault?
    No.
    Claude Code behaves as its reference documents;
    the repository registers a hook that cannot satisfy the event's contract.
2.  Can upstream fix it?
    Not applicable.
3.  Is the use case supported?
    Not applicable.
4.  Would the repository welcome a contribution?
    Not applicable.
5.  Would they likely fix it?
    Not applicable.
6.  Is a minimal fix prototyped?
    Not applicable upstream;
    the local fix is in "Proposed fix".

Decision:
nothing to file upstream,
and no draft is kept.
The upstream tracker was not searched,
because constraint 1 fails on the repository's own source.
