# mise 2026.5.15 uses current MISE_GITHUB_TOKEN and gets 401 when GitHub rejects it

This note records a local diagnosis from 2026-06-05 against mise 2026.5.15
(`v2026.5.15`, upstream commit `53cd329af53b04c68ac68f3d3b7cba1e4feeda37`).
The failure was not a mise cache problem. mise used the token present in the
current process environment, and GitHub rejected that token.

## Symptom

`mise ls-remote aws` or a tool resolution path for `aws` prints:

```text
mise WARN  Remote versions cannot be fetched: HTTP status client error (401 Unauthorized) for url (https://api.github.com/repos/aws/aws-cli/tags)
mise WARN  No versions found for aws
mise WARN  Error getting latest version for aws: no versions found for aws
```

The same terminal can show that mise resolved a GitHub token from the environment:

```text
github.com: ghp_…<redacted> (source: MISE_GITHUB_TOKEN)
```

## Root cause

### Step 1: mise gives `MISE_GITHUB_TOKEN` priority over other GitHub token sources

The release source for mise 2026.5.15 documents the GitHub token priority at
`src/github.rs:464-474`:

```rust
/// Priority:
/// 1. `MISE_GITHUB_ENTERPRISE_TOKEN` env var (non-github.com only)
/// 2. `MISE_GITHUB_TOKEN` / `GITHUB_API_TOKEN` / `GITHUB_TOKEN` env vars
/// 3. `credential_command` (if set)
/// 4. native GitHub OAuth device-flow token (if configured)
/// 5. `github_tokens.toml` (per-host)
/// 6. gh CLI token (from `hosts.yml`)
/// 7. `git credential fill` (if enabled)
pub fn resolve_token(host: &str) -> Option<(String, TokenSource)> {
```

The first non-empty environment token wins at `src/github.rs:492-500`:

```rust
// 2. Standard env vars (checked individually for correct precedence and source reporting)
for var_name in &["MISE_GITHUB_TOKEN", "GITHUB_API_TOKEN", "GITHUB_TOKEN"] {
    if let Some(token) = std::env::var(var_name)
        .ok()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
    {
        return Some((token, TokenSource::EnvVar(var_name)));
    }
}
```

That means any non-empty `MISE_GITHUB_TOKEN`, including an old or otherwise
rejected value, blocks fallback to gh CLI credentials, `github_tokens.toml`, or
unauthenticated public API access.

### Step 2: mise sends the resolved token as a GitHub API bearer token

For GitHub API URLs, mise adds the resolved token as an Authorization header at
`src/github.rs:572-578`:

```rust
if is_github_api_url(&url)
    && let Some((token, _source)) = resolve_token(url.host_str().unwrap_or("github.com"))
{
    headers.insert(
        reqwest::header::AUTHORIZATION,
        HeaderValue::from_str(format!("Bearer {token}").as_str()).unwrap(),
    );
```

If the current shell contains an old, revoked, malformed, or otherwise rejected
token, every new mise process sees that value and sends it.

### Step 3: `mise token github` reports source, not validity

`mise token github` calls the same resolver and prints the source at
`src/cli/token/github.rs:41-54`:

```rust
} else {
    github::resolve_token(&self.host)
};
match resolved {
    Some((token, source)) => {
        if self.raw {
            miseprintln!("{token}");
            return Ok(());
        }
        let display_token = if self.unmask {
            token
        } else {
            tokens::mask_token(&token)
        };
        miseprintln!("{}: {} (source: {})", self.host, display_token, source);
```

The command proves which token source mise will use. It does not call GitHub to
prove the token is accepted.

## Verification

Version and source under test:

```text
$ mise --version
2026.5.15 linux-x64 (2026-05-23)

$ git -C /tmp/agent/mise-2026.5.15 describe --tags --exact-match HEAD
v2026.5.15

$ git -C /tmp/agent/mise-2026.5.15 rev-parse HEAD
53cd329af53b04c68ac68f3d3b7cba1e4feeda37
```

### Catalog that works cleanly

Unauthenticated public API access succeeds when all token environment variables
are removed and mise uses a fresh cache directory:

```bash
cache_dir=$(mktemp --directory)
MISE_CACHE_DIR="$cache_dir" \
  env --unset=MISE_GITHUB_TOKEN --unset=GITHUB_API_TOKEN --unset=GITHUB_TOKEN \
  mise ls-remote aws 2>&1 | head --lines=5
rm --recursive --force "$cache_dir"
```

Observed output:

```text
2.34.34
2.34.35
2.34.36
2.34.37
2.34.38
```

The same public GitHub endpoint returned `200` without an Authorization header:

```text
without-token: 200
```

### Catalog that fails

The current shell's `MISE_GITHUB_TOKEN` source reproduces the mise warning:

```bash
mise token github
mise ls-remote aws 2>&1 | head --lines=5
```

Observed output, with the masked token suffix omitted:

```text
github.com: ghp_…<redacted> (source: MISE_GITHUB_TOKEN)
mise WARN  Remote versions cannot be fetched: HTTP status client error (401 Unauthorized) for url (https://api.github.com/repos/aws/aws-cli/tags)
mise WARN  No versions found for aws
```

A direct GitHub API probe with the same environment token also returned `401`:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  --header "Authorization: Bearer ${MISE_GITHUB_TOKEN}" \
  https://api.github.com/repos/aws/aws-cli/tags
```

Observed output:

```text
401
```

A fake token with a fresh mise cache reproduces the same failure mode:

```bash
cache_dir=$(mktemp --directory)
MISE_CACHE_DIR="$cache_dir" MISE_GITHUB_TOKEN=invalid-token-value \
  env --unset=GITHUB_API_TOKEN --unset=GITHUB_TOKEN \
  mise ls-remote aws 2>&1 | head --lines=5
rm --recursive --force "$cache_dir"
```

Observed output:

```text
mise WARN  Remote versions cannot be fetched: HTTP status client error (401 Unauthorized) for url (https://api.github.com/repos/aws/aws-cli/tags)
mise WARN  No versions found for aws
```

## Verified workarounds

### Refresh the shell environment

Open a new terminal, restart the long-running shell, or re-export the rotated
token in the shell that runs mise:

```bash
export MISE_GITHUB_TOKEN='<new token value>'
mise token github
```

Tradeoff: this only fixes processes launched after the export. Existing shells,
watchers, terminals, IDEs, and background services keep their old inherited
environment until restarted or explicitly updated.

### Remove the rejected token for a one-off public lookup

For public repositories, unset the token variables for a single command:

```bash
env --unset=MISE_GITHUB_TOKEN --unset=GITHUB_API_TOKEN --unset=GITHUB_TOKEN \
  mise ls-remote aws
```

Tradeoff: this falls back to unauthenticated access or lower-priority credential
sources. It can hit GitHub's lower unauthenticated rate limit and will not work
for private repositories that need the rotated token.

### Verify acceptance with GitHub, not just mise resolution

`mise token github` confirms source selection. A status-only API probe confirms
whether GitHub accepts the token without printing it:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  --header "Authorization: Bearer ${MISE_GITHUB_TOKEN}" \
  https://api.github.com/repos/aws/aws-cli/tags
```

Tradeoff: this sends one API request. It validates the exact token in the
current shell, not tokens configured in other terminals or services.

## What does not work

- Rotating or regenerating the token in GitHub's UI alone does not update a
  token value already exported into an existing process environment.
- Clearing mise's normal cache is not the root fix. A fake token failed with a
  fresh `MISE_CACHE_DIR`, which shows the failure follows the Authorization
  header, not stale version metadata.
- Expecting gh CLI credentials to take over while `MISE_GITHUB_TOKEN` is set
  does not work. `MISE_GITHUB_TOKEN` has higher priority than gh CLI tokens in
  `src/github.rs:464-474` and returns before lower-priority sources are checked
  in `src/github.rs:492-500`.

## Upstream filing artifact

### Duplicate search

Searched upstream issues and PRs with these queries on 2026-06-05:

```bash
gh search issues 'MISE_GITHUB_TOKEN 401 Unauthorized aws-cli tags' --repo jdx/mise --state open --limit 10
gh search issues 'MISE_GITHUB_TOKEN 401 Unauthorized aws-cli tags' --repo jdx/mise --state closed --limit 10
gh search prs 'MISE_GITHUB_TOKEN 401 Unauthorized aws-cli tags' --repo jdx/mise --state open --limit 10
gh search prs 'MISE_GITHUB_TOKEN 401 Unauthorized aws-cli tags' --repo jdx/mise --state closed --limit 10
gh search issues '401 Unauthorized GitHub token' --repo jdx/mise --state open --limit 10
gh search issues '401 Unauthorized GitHub token' --repo jdx/mise --state closed --limit 10
gh search prs '401 Unauthorized GitHub token' --repo jdx/mise --state open --limit 10
gh search prs '401 Unauthorized GitHub token' --repo jdx/mise --state closed --limit 10
```

No matching issue was found. The only PR search hit was closed PR `jdx/mise#401`,
`added rtx-java`, which is unrelated to token resolution.

### Upstream filing decision

1.  Is it really upstream's fault? No. mise chose the documented highest-priority
    environment token and GitHub rejected that token. The rejected value lives
    in the local process environment.
2.  Can upstream fix it? Not as a correctness bug. Upstream could improve wording
    for invalid environment tokens, but it cannot update already-running shells
    after a user rotates a token elsewhere.
3.  Are they supporting this use case? Yes. The upstream GitHub token docs cover
    `MISE_GITHUB_TOKEN`, `GITHUB_API_TOKEN`, `GITHUB_TOKEN`, gh CLI fallback, and
    `mise token github` debugging.
4.  Would the repo welcome our contribution? For non-obvious changes, the
    contribution guide asks contributors to start with a discussion or Discord.
    `.github/ISSUE_TEMPLATE/config.yml` disables blank issues and points bug
    reports and questions to GitHub Discussions. No AI-assistance ban was found
    in `CONTRIBUTING.md`, the fetched contribution guide, or the issue template.
5.  Will they likely fix it? No filing is warranted because constraint 1 fails.
    There is no upstream defect to fix.
6.  Have we prototyped a minimal fix compatible with their architecture? No.
    The auto-prototype rule does not trigger because constraints 1 and 5 do not
    hold.

### Nothing to file

Do not file an upstream issue as-is. The actionable fix is local environment
refresh or temporary token unsetting, not an upstream code change.
