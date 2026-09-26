# Git 2.55.0 hook off-switches each miss one hook source, so disabled events still run hooks

Git 2.54 added config-based hooks (`hook.<friendly-name>.command` plus `hook.<friendly-name>.event`)
next to the traditional hook file in the hooks directory,
and Git 2.55 added the event switch `hook.<event>.enabled`.
Both documented "turn hooks off" switches now cover only one of the two hook sources:

- Behavior A:
  `hook.<event>.enabled=false`,
  documented as "no hooks fire for that event",
  suppresses configured hooks but still runs the hookdir hook for that event.
  This is the primary upstream bug candidate.
- Behavior D:
  `core.hooksPath=/dev/null`,
  documented as the way to "disable all hooks entirely",
  suppresses the hookdir hook but still runs configured hooks.

Only both switches together silence an event.
The work tree and `core.worktree` quirks found in the same probe live in
[`git-private-admin-dir-hook-environment.md`](git-private-admin-dir-hook-environment.md).

## Symptom

No error or warning is printed in either case;
the wrong set of hooks simply runs.

### Behavior A: `hook.<event>.enabled=false` still runs `.git/hooks/<event>`

With an executable `.git/hooks/post-commit` and a configured hook `cfgpost` on `post-commit`:

```text
$ git -c hook.post-commit.enabled=false commit --no-verify -m x
hookdir post-commit ran            # hookdir hook still fires
                                   # cfgpost is skipped

$ git -c hook.post-commit.enabled=false hook list --show-scope post-commit
local	event-disabled	cfgpost
hook from hookdir                  # no event-disabled marker, and it does run
```

The same happens with the key in the repository's own config instead of `-c`,
and with `git hook run post-commit`.
For a blocking event the switch cannot unblock anything:
with `.git/hooks/pre-commit` exiting 1,
`git -c hook.pre-commit.enabled=false commit` still runs that hook and exits 1 with no commit.

### Behavior D: `core.hooksPath=/dev/null` still runs configured hooks

```text
$ git -c core.hooksPath=/dev/null commit --no-verify -m x
config cfgpost ran                 # configured hook still fires
```

`core.hooksPath=<empty directory>` behaves identically.
`git -c core.hooksPath=<dir> hook list post-commit` lists only the configured hook,
so `git hook list` is accurate here;
only the documentation promises more.

## Root cause

Source:
 Git `v2.55.0` (`e9019fcafe0040228b8631c30f97ae1adb61bcdc`,
 tagged 2026-06-29),
cloned with `gh repo clone git/git -- --depth 1 --branch v2.55.0`.
`hook.c` and `Documentation/config/hook.adoc` are byte-identical on `master` at `0f8e75ab` (2026-09-23).

### How Git builds the hook list

`list_hooks()` concatenates configured hooks and then the hookdir hook,
`hook.c:535-553`:

```c
// hook.c
struct string_list *list_hooks(struct repository *r, const char *hookname,
			       struct run_hooks_opt *options)
{
	...
	/* Add hooks from the config, e.g. hook.myhook.event = pre-commit */
	list_hooks_add_configured(r, hookname, hook_head, options);

	/* Add the default "traditional" hooks from hookdir. */
	list_hooks_add_default(r, hookname, hook_head, options);
```

### Behavior A: the event switch is recorded only on configured hooks

`hook.<name>.enabled=false` entries whose `<name>` is not a friendly-name become event-level switches,
`hook.c:378-386`:

```c
// hook.c (build_hook_config_map)
string_list_clear(&r->disabled_events, 0);
string_list_init_dup(&r->disabled_events);
for (size_t i = 0; i < cb_data.disabled_hooks.nr; i++) {
	const char *n = cb_data.disabled_hooks.items[i].string;
	if (!is_friendly_name(&cb_data, n))
		string_list_append(&r->disabled_events, n);
}
```

Only the configured-hook builder copies that state onto the hook,
`hook.c:489-490` and `hook.c:517`:

```c
// hook.c (list_hooks_add_configured)
bool event_is_disabled = r ? !!unsorted_string_list_lookup(&r->disabled_events,
							   hookname) : 0;
...
	hook->u.configured.event_disabled = event_is_disabled;
```

The flag lives inside the configured-only member of the union,
`hook.h:26-37`:

```c
// hook.h (struct hook)
union {
	struct {
		const char *path;
	} traditional;
	struct {
		const char *friendly_name;
		const char *command;
		enum config_scope scope;
		bool disabled;
		bool event_disabled;
	} configured;
} u;
```

so the hookdir builder has nowhere to put it and never looks at `r->disabled_events`,
`hook.c:116-119`:

```c
// hook.c (list_hooks_add_default)
h->kind = HOOK_TRADITIONAL;
h->u.traditional.path = xstrdup(hook_path);

string_list_append(hook_list, hook_path)->util = h;
```

The runner skips only configured hooks,
`hook.c:582-587`:

```c
// hook.c (pick_next_hook)
do {
	if (hook_cb->hook_to_run_index >= hook_list->nr)
		return 0;
	h = hook_list->items[hook_cb->hook_to_run_index++].util;
} while (h->kind == HOOK_CONFIGURED &&
	 (h->u.configured.disabled || h->u.configured.event_disabled));
```

`hook_exists()` treats any hookdir hook as present,
`hook.c:562-563`:

```c
// hook.c (hook_exists)
if (h->kind == HOOK_TRADITIONAL ||
    (!h->u.configured.disabled && !h->u.configured.event_disabled)) {
```

and `git hook list` prints hookdir hooks without a status,
`builtin/hook.c:84-86`:

```c
// builtin/hook.c (list)
case HOOK_TRADITIONAL:
	printf("%s%c", _("hook from hookdir"), line_terminator);
	break;
```

The documentation promises all hooks,
`Documentation/config/hook.adoc:49-53`:

```text
hook.<event>.enabled::
	Switch to enable or disable all hooks for the `<event>` hook event.
	When set to `false`, no hooks fire for that event, regardless of any
	per-hook `hook.<friendly-name>.enabled` settings. Defaults to `true`.
```

So does the introducing commit,
`dcfb5af67e7d` ("hook:
 add hook.<event>.enabled switch",
 Adrian Ratiu,
 2026-04-10):
"Add a hook.<event>.enabled config key that disables all hooks for a given event".
The review suggestion that led to it
(Junio C Hamano,
 2026-03-16,
 "Re:
 [PATCH v3 7/9] hook:
 add per-event jobs config")
asked for "a master switch to prevents all hooks from firing for a particular event".
Neither message nor the adjacent review replies mention the hookdir hook.

The tests only use configured hooks,
and the first one cannot fail:
`t/t1800-hook.sh:1110-1116` asserts that stdout is empty,
but `git hook run` sends hook stdout to stderr (`hook.h:171-176`,
 `.stdout_to_stderr = 1`),
so the assertion holds whether or not the hook ran:

```sh
# t/t1800-hook.sh
test_expect_success 'hook.<event>.enabled=false skips all hooks for event' '
	test_config hook.hook-1.event test-hook &&
	test_config hook.hook-1.command "echo ran" &&
	test_config hook.test-hook.enabled false &&
	git hook run --allow-unknown-hook-name test-hook >out 2>err &&
	test_must_be_empty out
'
```

### Behavior D: `core.hooksPath` only relocates the hooks directory

`find_hook()` resolves `hooks/<name>` through the repository path machinery,
which is where `core.hooksPath` applies,
`hook.c:26-36`:

```c
// hook.c
const char *find_hook(struct repository *r, const char *name)
{
	...
	repo_git_path_replace(r, &path, "hooks/%s", name);
	found_hook = access(path.buf, X_OK) >= 0;
```

`/dev/null/post-commit` is never executable,
so `list_hooks_add_default()` adds nothing,
but `list_hooks_add_configured()` reads `hook.*` config
(`hook.c:368`,
 `repo_config(r, hook_config_lookup_all, &cb_data)`)
without consulting the hooks directory at all.
The documentation predates config-based hooks,
`Documentation/config/core.adoc:529-532`:

```text
You can also disable all hooks entirely by setting `core.hooksPath`
to `/dev/null`. This is usually only advisable for expert users and
on a per-command basis using configuration parameters of the form
`git -c core.hooksPath=/dev/null ...`.
```

That paragraph came from the 2025 "docs:
 document core.hooksPath=/dev/null" series
([gitgitgadget/git#1899][ggg-1899],
 Derrick Stolee,
 2025-04-02),
which replaced a proposed `--no-hooks` option.
Config-based hooks arrived later,
so the sentence became inaccurate rather than being wrong when written.
Relocating the hooks directory is the variable's defined job (`Documentation/config/core.adoc:512-517`),
so Behavior D is a stale-documentation problem;
whether `/dev/null` should instead become a real "no hooks" switch is a design question for upstream.

This is not a security boundary change:
the configured hooks come from config files,
and a repository's own `.git/config` could already run commands through keys such as `core.fsmonitor`,
so `core.hooksPath=/dev/null` never made an untrusted `.git/config` safe.

## Verification

Verified 2026-09-25 against Fedora `git-core-2.55.0-1.fc44.x86_64` (`/usr/bin/git`,
 `git version 2.55.0`)
and against Git built from tag `v2.55.0` (`e9019fca`) in a container
(`make NO_RUST=1 NO_CURL=1 NO_EXPAT=1 NO_TCLTK=1 NO_GETTEXT=1 NO_PERL=1 NO_PYTHON=1 all`);
both builds gave identical results.
The `git` on this repo's `PATH` is a wrapper,
so host runs pinned `/usr/bin/git`,
with `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`,
in a disposable `mktemp --directory "${HOME}/temp/agent/..."` directory removed afterwards.
The full driver was a Node TypeScript harness (cases A1 to A7,
 D1,
 D2);
the shell snippet reproduces the same results by hand.

### Harness

```sh
# Behaviors A and D: run in an empty scratch directory with Git 2.55.0 first on PATH
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
git init --quiet --initial-branch=main repo && cd repo
git config user.name Probe && git config user.email probe@example.invalid
printf '#!/bin/sh\necho "hookdir post-commit ran"\n' >.git/hooks/post-commit
chmod +x .git/hooks/post-commit
git config hook.cfgpost.event post-commit
git config hook.cfgpost.command 'echo "config cfgpost ran"'
echo "== A: hook.post-commit.enabled=false"
git -c hook.post-commit.enabled=false commit --quiet --allow-empty --message=a 2>&1
git -c hook.post-commit.enabled=false hook list --show-scope post-commit
echo "== D: core.hooksPath=/dev/null"
git -c core.hooksPath=/dev/null commit --quiet --allow-empty --message=d 2>&1
echo "== both switches"
git -c core.hooksPath=/dev/null -c hook.post-commit.enabled=false commit --quiet --allow-empty --message=b 2>&1
echo "== blocking pre-commit under hook.pre-commit.enabled=false"
printf '#!/bin/sh\nexit 1\n' >.git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
git -c hook.pre-commit.enabled=false commit --quiet --allow-empty --message=p
echo "exit=$?"
```

Expected output at `v2.55.0`:

```text
== A: hook.post-commit.enabled=false
hookdir post-commit ran
local	event-disabled	cfgpost
hook from hookdir
== D: core.hooksPath=/dev/null
config cfgpost ran
== both switches
== blocking pre-commit under hook.pre-commit.enabled=false
exit=1
```

### Switch combinations that behave as documented

- A2 control (no switch):
  both `config cfgpost` and `hookdir post-commit` run.
- `hook.<friendly-name>.enabled=false`:
  skips exactly that configured hook (upstream test `t/t1800-hook.sh:1134-1143`).
- A7 `-c core.hooksPath=/dev/null -c hook.post-commit.enabled=false`:
  nothing runs.
- `commit --no-verify`:
  skips `pre-commit` and `commit-msg` from both sources,
  as documented for that flag;
  `prepare-commit-msg` and `post-commit` still run (earlier probe,
   case 2e).

### Switch combinations that leave hooks running

`hook.<event>.enabled=false` (Behavior A),
the hookdir hook still runs:

- A1 `-c hook.post-commit.enabled=false commit`
- A4 `-c hook.post-commit.enabled=false hook run post-commit`
- A5 repository config `hook.post-commit.enabled=false`
- A6 `-c hook.pre-commit.enabled=false commit` with a rejecting hookdir `pre-commit`:
  exit 1,
   no commit
- A3 `git hook list` shows `hook from hookdir` with no `event-disabled` marker

`core.hooksPath` pointing away from the hooks (Behavior D),
the configured hook still runs:

- D1 `-c core.hooksPath=/dev/null commit`
- D2 `-c core.hooksPath=<empty dir> commit`

## Verified workarounds

### Workaround 1: set both switches for every event you need silenced

```sh
git -c core.hooksPath=/dev/null \
    -c hook.pre-commit.enabled=false \
    -c hook.prepare-commit-msg.enabled=false \
    -c hook.commit-msg.enabled=false \
    -c hook.post-commit.enabled=false \
    commit ...
```

Verified as case A7 for `post-commit`.
Tradeoffs:
the event list must be complete for the command
(`githooks(5)` lists which events each command fires),
and forgetting one silently leaves its configured hooks running;
when Git gains an event-level fix the extra `core.hooksPath` becomes redundant but harmless.

### Workaround 2: dispatcher shim that runs selected hooks explicitly

The earlier probe
(its phase 3 cases named `D1` and `D2`,
 unrelated to this document's D1 and D2)
verified a `core.hooksPath` shim directory
combined with `hook.<event>.enabled=false` for every commit event:
Git runs only the shim's hookdir scripts (Behavior A lets them through),
and each shim re-enables its own event and calls
`git -c hook.<event>.enabled=true -c core.hooksPath=<original hooks dir> hook run --ignore-missing <event> -- "$@"`.
For each event the shim directory provides,
configured hooks and the original hookdir hook then run exactly once,
and a failing hook still fails the commit;
an event the shim directory omits (the probe left out `post-commit` on purpose)
runs no hooks from either source.
Tradeoffs:
it depends on Behavior A staying unfixed
(after an upstream fix the shim itself would be event-disabled and nothing would run),
so it needs a version gate;
and it adds one `git` process per event.

## What does not work

- `hook.<event>.enabled=false` alone:
  hookdir hook still runs (A1,
   A4,
   A5,
   A6).
- `core.hooksPath=/dev/null` or an empty directory alone:
  configured hooks still run (D1,
   D2).
- `hook.<friendly-name>.enabled=false` for every configured hook:
  works only for hooks you know the names of,
  and does nothing for the hookdir hook.
- `--no-verify`:
  covers only `pre-commit` and `commit-msg` for `git commit`
  (and `pre-merge-commit` for merges);
  `post-commit` still runs.
- Reading `git hook list` to decide whether an event is off:
  under Behavior A it lists the hookdir hook without any marker,
  which is at least truthful because it does run.

## Upstream filing artifact

### Upstream filing decision

`.out-of-scope/` has no entry for Git
(checked `bun-install.md`,
`cargo-workspace.md`,
`claude-code-upstream-bugs.md`,
`codex-harness.md`,
`jsr.md`,
`lightningcss.md`,
`low-impact-typescript-formatting.md`,
`module-es-monolith.md`,
`pi-gpt55-long-context.md`,
`terminal-title-fork-parity-tests.md`,
`typescript-project-references.md`).

Duplicate search,
2026-09-25:
Git tracks bugs on `git@vger.kernel.org`,
not GitHub issues
(`.github/CONTRIBUTING.md`:
 "we use a mailing list ... for code submissions,
 code reviews,
 and bug reports").
`gh search prs --repo git/git 'hook enabled'` and `'config-based hooks'` returned only unrelated PRs (#988,
 #1271);
`gh search prs --repo gitgitgadget/git 'hook enabled'` returned #908 (project-configured hooks RFC) and #1899
(the `core.hooksPath=/dev/null` docs),
neither about this.
`lore.kernel.org/git` blocked automated access (Anubis challenge,
 including a headless browser),
so the archive was searched through `ratatoskr.run` and `public-inbox.org` indexes
for `hook.<event>.enabled`,
 "event-disabled",
 and hookdir terms;
the only hits were the patch series that introduced the feature
and the "What's cooking" entries for `ar/parallel-hooks`,
none reporting this behavior.
No duplicate found.

#### Constraint 1: is it really upstream's fault?

Behavior A:
yes.
The documentation (`Documentation/config/hook.adoc:49-53`),
the commit message of `dcfb5af67e7d`,
and the maintainer's design request all say "all hooks";
the code applies the switch only to `HOOK_CONFIGURED` entries.
This is a behavior bug,
 not wording.

Behavior D:
yes for the wording.
`Documentation/config/core.adoc:529-532` says "disable all hooks entirely";
since config-based hooks it disables only hookdir hooks.

#### Constraint 2: can upstream fix it?

Yes.
Behavior A needs the hookdir entry to carry the event flag and the three consumers
(`pick_next_hook()`,
 `hook_exists()`,
 `git hook list`) to honour it.
Behavior D needs a documentation sentence,
or,
if upstream prefers,
a code change making `/dev/null` also skip configured hooks.

#### Constraint 3: are they supporting this use case?

Yes.
`hook.<event>.enabled` is a documented config key with tests (`t/t1800-hook.sh:1110-1170`),
hookdir hooks are the default hook source,
and `core.hooksPath=/dev/null` is a documented recipe.

#### Constraint 4: would the repo welcome our contribution?

Yes,
 with a condition.
Git accepts bug reports and patches from anyone on the list (`README.md:32-36`).
`Documentation/SubmittingPatches:499-525` ("Use of Artificial Intelligence (AI)")
does not ban AI assistance but says the project "will reject anything that looks AI generated,
that sounds overly formal or bloated,
 ... or that senders don't understand or cannot explain",
and doubts the Developer's Certificate of Origin can be satisfied
for "significant amount of content that has been generated by AI tools".
So the human sender must write the email in their own words,
re-run the reproduction and the patched test,
understand the fix well enough to defend it in review,
and sign off only on code they are comfortable certifying;
the fix is small enough to rewrite by hand.
The draft is reference material for that,
not text to paste.

#### Constraint 5: will they likely fix it?

Likely.
The feature is recent (in `ar/parallel-hooks`,
 cooked April 2026,
 released in `v2.55.0`),
the author and reviewers are active on the hook code
(12-patch "config-hook cleanups" series in March 2026),
and the maintainer explicitly asked for a switch that "prevents all hooks from firing".
No won't-fix or stated non-goal was found.

#### Constraint 6: have we prototyped a minimal fix compatible with their architecture?

Yes.
Constraints 1 to 5 hold (4 with the disclosure condition),
so the auto-prototype step ran:
see "Prototype fix".

Decision:
fileable as one report covering both switches,
after the human rewrite that constraint 4 requires.
Do not file from this session;
this project keeps drafts local until the user decides.

### Prototype fix

Built in a disposable clone
(`mktemp --directory "${HOME}/temp/agent/upstream-prototype.XXXXXXXX"`,
`gh repo clone git/git -- --depth 1 --branch v2.55.0`,
origin `https://github.com/git/git.git`,
`HEAD` `e9019fcafe0040228b8631c30f97ae1adb61bcdc` = `v2.55.0`,
push URL set to `DISABLED`).
The diff is [`git-hook-disable-switches.patch`](git-hook-disable-switches.patch)
(apply with `git apply` on `v2.55.0`):

- `hook.h`:
  move `event_disabled` out of the configured-only union member into `struct hook`,
  so both hook kinds can carry it.
- `hook.c`:
  `list_hooks_add_default()` sets `h->event_disabled` from `r->disabled_events`
  (already populated by `list_hooks_add_configured()`,
   which `list_hooks()` calls first);
  `pick_next_hook()` skips any event-disabled hook;
  `hook_exists()` ignores event-disabled hooks of either kind.
- `builtin/hook.c`:
  `git hook list` prints `event-disabled<TAB>hook from hookdir`.
- `t/t1800-hook.sh`:
  three tests (hookdir hook skipped by `git hook run` with stdout and stderr both checked;
  `git hook list` marker;
   failing hookdir `pre-commit` no longer blocks `git commit`).
- `Documentation/config/core.adoc`:
  say `core.hooksPath=/dev/null` disables hooks in the hooks directory
  and point at `hook.<event>.enabled` for configured hooks (Behavior D,
   wording option).

Verification ran in `podman run --memory=2g --cpus=2 --rm --network=none` on `node:22-bookworm`,
with both source trees copied into the image (no mounts,
 no credentials),
building pristine and patched trees with the `make` line from "Verification".

Before the patch (pristine `v2.55.0` build,
 with the patched `t/t1800-hook.sh` copied in):

```text
### pristine: t1800-hook.sh (patched test file)
not ok 89 - hook.<event>.enabled=false also skips the hook from the hookdir
not ok 90 - git hook list shows the hookdir hook as event-disabled
not ok 91 - hook.<event>.enabled=false skips a failing hookdir pre-commit
# failed 3 among 95 test(s)
```

The same pristine build reproduced A1 to A6 and D1 to D2 exactly as `/usr/bin/git` did.

After the patch:

```text
### patched: repro harness
== A1 -c hook.post-commit.enabled=false commit --no-verify
  hooks that ran: <empty>
== A3 git -c hook.post-commit.enabled=false hook list --show-scope post-commit
    local	event-disabled	cfgpost
    event-disabled	hook from hookdir
== A4 git -c hook.post-commit.enabled=false hook run post-commit
  hooks that ran: <empty>
== A5 repo-local config hook.post-commit.enabled=false, commit --no-verify
  hooks that ran: <empty>
== A6 -c hook.pre-commit.enabled=false commit (hookdir pre-commit exits 1)
  exit=0
== A2 control, no switch: config cfgpost, hookdir post-commit (unchanged)
### patched: t1800-hook.sh (patched test file)
# passed all 95 test(s)
### patched: related hook suites
== t7503-pre-commit-and-pre-merge-commit-hooks.sh
# passed all 22 test(s)
== t7504-commit-msg-hook.sh
not ok 29 - merge --continue remembers --no-verify # TODO known breakage
# still have 1 known breakage(s)
# passed all remaining 29 test(s)
== t7505-prepare-commit-msg-hook.sh
# passed all 23 test(s)
== t5571-pre-push-hook.sh
# passed all 11 test(s)
== t1416-ref-transaction-hooks.sh
# passed all 10 test(s)
== t5403-post-checkout-hook.sh
# passed all 14 test(s)
```

The `t7504` "known breakage" is a `test_expect_failure` already present at `v2.55.0`.
D1 and D2 are unchanged by the patch,
as expected for the wording-only `core.adoc` hunk;
that hunk was reviewed as text but not rendered through the AsciiDoc toolchain,
which the container did not have.
The full suite (`make test`) was not run.

### Draft

Git reports go to `git@vger.kernel.org` as plain-text email (patches inline via `git send-email` or GitGitGadget).
Per constraint 4 the sender rewrites this in their own words before sending.

~~~md
Subject: hook.<event>.enabled=false does not skip the hook from the hookdir

Documentation/config/hook.adoc says of hook.<event>.enabled:

    When set to `false`, no hooks fire for that event, regardless of any
    per-hook `hook.<friendly-name>.enabled` settings.

In v2.55.0 it only skips hooks configured with hook.<name>.command.
An executable $GIT_DIR/hooks/<event> still runs:

    git init repo && cd repo
    printf '#!/bin/sh\necho hookdir ran\n' >.git/hooks/post-commit
    chmod +x .git/hooks/post-commit
    git config hook.cfg.event post-commit
    git config hook.cfg.command 'echo config ran'
    git -c hook.post-commit.enabled=false commit --allow-empty -m x
    # prints "hookdir ran"; "config ran" is correctly skipped
    git -c hook.post-commit.enabled=false hook list post-commit
    # event-disabled  cfg
    # hook from hookdir         <- no marker, and it runs

With a failing .git/hooks/pre-commit, hook.pre-commit.enabled=false
does not let the commit through either.

The event flag lives in hook->u.configured, so list_hooks_add_default()
cannot set it, and pick_next_hook() / hook_exists() only check it for
HOOK_CONFIGURED. The existing test "hook.<event>.enabled=false skips all
hooks for event" in t1800 uses only a configured hook and checks that
stdout is empty, but "git hook run" sends hook output to stderr, so that
assertion passes even when the hook runs.

The mirror image exists for core.hooksPath: core.adoc says setting it to
/dev/null will "disable all hooks entirely", but since config-based
hooks that only disables the hookdir, and hook.<name>.command hooks
still run. So today only the combination

    git -c core.hooksPath=/dev/null -c hook.<event>.enabled=false ...

turns an event off.

A fix for the first part: move event_disabled into struct hook, set it
in list_hooks_add_default() from r->disabled_events (populated by
list_hooks_add_configured(), which runs first), and have
pick_next_hook(), hook_exists() and "git hook list" check it for both
kinds. For core.hooksPath either the doc sentence gets narrowed to the
hooks directory, or /dev/null also turns off configured hooks; which
would you prefer?

A patch with tests for the first part follows if this direction is OK.
~~~

[ggg-1899]: https://github.com/gitgitgadget/git/pull/1899
