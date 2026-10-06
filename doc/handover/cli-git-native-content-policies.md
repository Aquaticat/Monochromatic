# cli-git native content policies

## Purpose and how to respond

This branch makes three content policies work in the native wrapper
for `git add` and for the direct `git cli-git check` and `git cli-git fix` commands:
the built-in `final-newline`,
`security/forbidden-strings`
and `mono/forbidden-root-context`.
`markdown/autofix` and `mono/dependent-version-bump` stay unported
and keep refusing with exit 2 whenever they are enabled.

Paths starting with `src/` or `bin/` are relative to `package/git-policy/cli/`;
every other path is repository-relative.

Work is recorded slice by slice as it lands.
Respond by merging the branch into `main` and by vetoing any item under "Choices open to veto".

## Status

In progress.
Done:
the differential harness probe.

## Differential harness

### How the incumbent runs with its optional plugins

The incumbent is the built TypeScript wrapper of the main checkout,
`package/git-policy/cli/dist/final/node/index.mjs`
(built 2026-09-26 15:43, after the last source commit under `package/git-policy/cli/src`,
`cf2bf70d2` at 15:39 the same day).
It is run as `node <that file> <arguments>` with `PATH=/usr/bin:/bin`,
so its real Git is `/usr/bin/git`.

Each disposable repository lives under a `mktemp`-style directory below `${HOME}/temp/agent/`.
The directory above the repository holds a `node_modules/@monochromatic-dev/git-policy-cli` link
to the main checkout's package,
so the incumbent's `cli-git.config.ts` can import `@monochromatic-dev/git-policy-cli/ts`
when `git cli-git trust --yes` bundles it.
Every run gets a disposable `HOME`,
`GIT_CONFIG_NOSYSTEM=1`,
`GIT_CONFIG_GLOBAL=/dev/null`,
fixed author and committer identities,
and a disposable `FORBIDDEN_STRINGS_CACHE_DIR`;
`FORBIDDEN_STRINGS_RULES` is unset unless a case sets it.

### Probe result

A first probe on 2026-10-06 confirmed the harness before any Rust was written:
`git cli-git trust --yes` trusted the configuration,
`git cli-git check -- a.txt b.txt` reported one `final-newline` warning and one forbidden-strings error and exited 1,
`git add -- b.txt` staged with a `final-newline` warning,
and `git add -- a.txt` exited 1 with a redacted forbidden-strings finding and left `a.txt` unstaged.
