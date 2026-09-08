# mise-action 4.0.1 installs the version `mise.jdx.dev/VERSION` advertises and fails every job while that version has no GitHub release

## Symptom

Every job of `.github/workflows/npm-release.yml` for commit `80302aa1f` (run 34228368589,
 2026-09-08T12:50Z) failed in the step "Set up mise (skip auto-install of all tools)",
 before any repository code ran:

```text
[command]/usr/bin/curl -fsSL https://mise.jdx.dev/VERSION
2026.9.3
[command]/usr/bin/sh -c curl -fsSL https://github.com/jdx/mise/releases/download/v2026.9.3/mise-v2026.9.3-linux-x64.tar.zst | tar --zstd -xf - -C /tmp && mv /tmp/mise/bin/mise ...
curl: (22) The requested URL returned error: 404
zstd: /*stdin*\: unexpected end of file
tar: Child returned status 1
##[error]The process '/usr/bin/sh' failed with exit code 2
```

At the same time,
 from this machine:

```text
$ curl -sS https://mise.jdx.dev/VERSION
2026.9.3
$ curl -sI -o /dev/null -w '%{http_code}\n' https://github.com/jdx/mise/releases/download/v2026.9.3/mise-v2026.9.3-linux-x64.tar.zst
404
$ gh release list --repo jdx/mise --limit 1
v2026.9.2: Packslip Backend, SSH Relay, and Reimagined Install Progress   Latest   v2026.9.2   2026-09-07T22:25:21Z
$ curl -sI https://mise.jdx.dev/mise-latest-linux-x64.tar.zst | head -2
HTTP/2 200
content-length: 18029953
```

The version file names a release that does not exist on GitHub yet,
 while the archive mise hosts itself serves.
Every workflow in this repository that uses `jdx/mise-action` without a `version` input
 (`npm-release.yml`,
 `cargo-publish.yml`,
 `cli-git-performance.yml`,
 `cli-git-trust.yml`,
 `kotlin-linter-publish.yml`,
 `logger-fuzz.yml`,
 `readonly-semantic-bridge.yml`,
 `toml-edit-fuzz.yml`)
 fails the same way during such a window.

## Root cause

`jdx/mise-action` at the pinned commit `1648a7812b9aeae629881980618f079932869151` (tag `v4.0.1`)
 reads the `version` and `fetch_from_github` inputs and hands them to `setupMise`
 (`src/index.ts:57`):

```ts
    const version = core.getInput('version')
    const fetchFromGitHub = core.getBooleanInput('fetch_from_github')
    await setupMise(version, fetchFromGitHub)
```

With no `version`,
 the version to install comes from `latestMiseVersion` (`src/index.ts:248`):

```ts
    let resolvedVersion = version || (await latestMiseVersion())
    resolvedVersion = resolvedVersion.replace(/^v/, '')
    let url: string
    if (!fetchFromGitHub && !version) {
      // Only for latest version
      url = `https://mise.jdx.dev/mise-latest-${await getTarget()}${ext}`
    } else {
      url = `https://github.com/jdx/mise/releases/download/v${resolvedVersion}/mise-v${resolvedVersion}-${await getTarget()}${ext}`
    }
```

and `latestMiseVersion` is one fetch of the version file (`src/index.ts:327`):

```ts
async function latestMiseVersion(): Promise<string> {
  const rsp = await exec.getExecOutput('curl', [
    '-fsSL',
    'https://mise.jdx.dev/VERSION'
  ])
  return rsp.stdout.trim()
}
```

`fetch_from_github` defaults to `"true"` (`action.yml:80`),
 so the default path is:
 read the version file,
 then download that exact version from the GitHub release.
Nothing checks that the release exists,
 and nothing falls back to the mise-hosted `mise-latest-*` archive that the `fetch_from_github: false` branch uses.
Whenever the version file is updated before the GitHub release carries its assets
 (or after a release is removed),
 every unpinned consumer fails for the length of that window.
Which side of `jdx/mise` publishes the version file,
 and whether it is meant to move before or after the release assets,
 was not traced;
 the observable contract is only that the two disagreed for at least the minutes covered by the probes above.

## Verification

Version under test:
 `jdx/mise-action` commit `1648a7812b9aeae629881980618f079932869151` (`v4.0.1`),
 inputs `install: false`,
 `cache: true`,
 no `version`,
 `fetch_from_github` at its default.
Harness,
 reproducing the action's two requests from any shell:

```bash
version="$(curl -fsSL https://mise.jdx.dev/VERSION)"
curl -sI -o /dev/null -w '%{http_code}\n' "https://github.com/jdx/mise/releases/download/v${version}/mise-v${version}-linux-x64.tar.zst"
```

Patterns that fail:

- Any job during a window where the second command prints `404`
   (2026-09-08,
   `2026.9.3`,
   from at least 12:50Z until the asset answered 200 at about 13:57Z,
   polled once a minute).

Patterns that work:

- The same workflow once the release carries its assets
   (run 34111678810 on 2026-09-07 installed `2026.9.2` this way).
- `curl -sI https://mise.jdx.dev/mise-latest-linux-x64.tar.zst` returned `200` throughout the window,
   which is the archive the `fetch_from_github: false` branch downloads.

## Verified workarounds

1.   Rerun the failed run once the release exists:
     `gh run rerun --failed <run id>`.
     Verified for run 34228368589 as recorded in `doc/planning/module-fs-path-deepening.md`.
     Tradeoff:
     manual,
     and the window length is upstream's;
     a run that must happen now cannot.
2.   Set `fetch_from_github: false` on the action:
     the archive then comes from `mise.jdx.dev/mise-latest-<target>`,
     which served throughout the window.
     Verified only at the HTTP level (`200`,
     18 MB);
     no workflow in this repository has run with it yet.
     Tradeoff:
     the installed version is whatever that archive holds at the moment,
     which the log then does not name,
     and the download leaves GitHub's CDN.
3.   Pin `version:` to a release known to exist.
     The action builds the GitHub URL from the pinned value and never reads the version file.
     Tradeoff:
     the pin needs a maintenance rule (the repository's `PIN` rule wants a comment saying why),
     and eight workflows would carry it.

Choosing between 2 and 3 for the workflows is tracked in the GitHub issue linked from the planning record;
 this note records the mechanism.

## What does not work

- Waiting inside the job:
   the action has no retry or fallback on the release download,
   so a rerun is the only way to try again.
- Reading the version from `mise.lock`:
   this repository locks tools,
   not mise itself,
   so there is no committed mise version to pin to without adding one.

## Upstream filing decision

`.out-of-scope/` holds no entry for mise or mise-action (checked 2026-09-08 with `rg -i mise .out-of-scope`).

1.   Is it really upstream's fault?
     Partly.
     The action trusts the version file without checking the release;
     the version file moved ahead of the release.
     Which of the two repositories owns the ordering was not traced.
2.   Can upstream fix it?
     Yes:
     the action could fall back to the `mise-latest-*` archive when the release asset returns 404 for an unpinned install,
     or the release pipeline could update the version file after the assets exist.
3.   Are they supporting this use case?
     Yes:
     no `version` is the documented default (`README.md:19` reads `[default: latest]`).
4.   Would the repo welcome our contribution?
     `jdx/mise-action` at `v4.0.1` has no `CONTRIBUTING.md`,
     no `AGENTS.md`,
     and no issue template;
     no ban on outside or AI-assisted reports was found in `README.md`.
5.   Will they likely fix it?
     No signal either way:
     `gh search issues --repo jdx/mise-action 'VERSION 404'`,
     `'latest version release not published'`,
     and `gh search issues --repo jdx/mise 'VERSION file updated before release assets'` returned nothing.
6.   Have we prototyped a minimal fix?
     No.
     Not attempted in this session:
     the failure clears itself when the release lands,
     the local workarounds need no upstream change,
     and constraint 1 is unresolved between two repositories,
     so a prototype in either could target the wrong one.

Decision:
 do not file as-is.
Draft kept for a future session that observes the window again and resolves constraint 1:

~~~md
Title: Unpinned install fails while mise.jdx.dev/VERSION is ahead of the GitHub release

Labels: bug

With no `version` input and `fetch_from_github` at its default, `setupMise` reads
`https://mise.jdx.dev/VERSION` (`src/index.ts:327`) and downloads
`https://github.com/jdx/mise/releases/download/v<version>/mise-v<version>-<target><ext>`
(`src/index.ts:255`). When the version file names a release whose assets are not
published yet, every consumer fails with `curl: (22) ... 404`. Observed 2026-09-08
with `2026.9.3` in the version file while `gh release list --repo jdx/mise` showed
`v2026.9.2` as latest; `https://mise.jdx.dev/mise-latest-linux-x64.tar.zst` served
throughout.

Reproduce:

```bash
version="$(curl -fsSL https://mise.jdx.dev/VERSION)"
curl -sI -o /dev/null -w '%{http_code}\n' "https://github.com/jdx/mise/releases/download/v${version}/mise-v${version}-linux-x64.tar.zst"
```

Suggested fix: in `setupMise`, when no `version` was given and the GitHub asset
returns 404, fall back to the `mise-latest-<target>` archive the
`fetch_from_github: false` branch already uses, or check the release exists before
choosing the version.
~~~
