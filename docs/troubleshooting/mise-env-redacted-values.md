# mise 2026.5.15 `env --redacted` lists sensitive values instead of masking them

This note records a 2026-06-06 diagnosis against mise 2026.5.15
(`v2026.5.15`, upstream commit `53cd329af53b04c68ac68f3d3b7cba1e4feeda37`).
The surprising behavior is real: `mise env --redacted` means "only show variables
that have been marked for redaction," not "print env output with values masked."

## Symptom

A user runs this command, expecting masked output:

```bash
mise env --redacted
```

Observed shape:

```bash
export SECRET_TOKEN=fixture-secret-token
```

The same applies to value-only and JSON output:

```text
fixture-secret-token
```

```json
{
  "SECRET_TOKEN": "fixture-secret-token"
}
```

For real tokens, that output should be treated as an exposure in terminal
scrollback, shell capture logs, CI logs, agent transcripts, and command-history
recorders that store output.

## Root cause

### Step 1: the flag is documented as a selector, not a masker

The CLI struct describes the flag at `src/cli/env.rs:38-40`:

```rust
/// Only show redacted environment variables
#[clap(long)]
redacted: bool,
```

The generated CLI docs carry the same wording at `docs/cli/env.md:47-49`:

```md
### `--redacted`

Only show redacted environment variables
```

The environment docs show how variables become "redacted variables" at
`docs/environments/index.md:122-133`:

```toml
[env]
SECRET = { value = "my_secret", redact = true }
_.file = { path = ".env.json", redact = true }
```

```toml
redactions = ["SECRET_*", "*_TOKEN", "PASSWORD"]
[env]
SECRET_KEY = "sensitive_value"
API_TOKEN = "token_123"
PASSWORD = "my_password"
```

The docs then explicitly present `mise env --redacted --values` as a way to show
"values of redacted variables" at `docs/environments/index.md:151-152`:

```bash
# Show only values of redacted variables
mise env --redacted --values
```

So upstream uses "redacted" as a classification label. It does not promise that
this command masks values before printing them.

### Step 2: mise builds a set of sensitive keys

`src/cli/env.rs:68-76` collects keys from env directives and config-level
redaction patterns:

```rust
let redacted_keys = if self.redacted {
    let env_results = config.env_results().await?;
    let mut keys = IndexSet::new();
    keys.extend(env_results.redactions.clone());
    if let Some((_, ref tools_env_results)) = final_env {
        keys.extend(tools_env_results.redactions.clone());
    }
    keys.extend(config.redaction_keys());
    Some(keys)
} else {
```

Env directives add keys to that sensitive-key list when `redact = true`. For
plain `[env]` values, `src/config/env_directive/mod.rs:354-361` stores the key:

```rust
r.env_remove.remove(&k);
// trace!("resolve: inserting {:?}={:?} from {:?}", &k, &v, &source);
if redact.unwrap_or(false) {
    r.redactions.push(k.clone());
}
env.insert(k, (v, Some(source.clone())));
```

For env files, `src/config/env_directive/mod.rs:453-461` stores each loaded key
when the file directive has `redact = true`:

```rust
r.env_files.push(f.clone());
for (k, v) in new_env {
    if resolve_opts.vars {
        r.vars.insert(k, (v, f.clone()));
    } else {
        if redact.unwrap_or(false) {
            r.redactions.push(k.clone());
        }
        env.insert(k, (v, Some(f.clone())));
```

### Step 3: output paths filter by key and then print raw values

The shell-output path filters env entries by key at `src/cli/env.rs:184-188`:

```rust
let mut env = ts.env_with_path(config).await?;

if let Some(keys) = redacted_keys {
    env.retain(|k, _| self.should_include_key(k, keys));
}
```

Then it prints the raw value in a shell assignment at `src/cli/env.rs:190-193`:

```rust
for (k, v) in env {
    let k = k.to_string();
    let v = v.to_string();
    miseprint!("{}", shell.set_env(&k, &v))?;
```

The JSON path follows the same pattern: filter at `src/cli/env.rs:100-104`, then
serialize the remaining map at `src/cli/env.rs:106`:

```rust
let mut env = ts.env_with_path(config).await?;

if let Some(keys) = redacted_keys {
    env.retain(|k, _| self.should_include_key(k, keys));
}

miseprintln!("{}", serde_json::to_string_pretty(&env)?);
```

The value-only path filters at `src/cli/env.rs:221-225`, then prints each raw
value at `src/cli/env.rs:227-228`:

```rust
for (_, v) in env {
    miseprintln!("{}", v);
}
```

The shared predicate confirms that `--redacted` answers "which keys are
redaction-marked?" at `src/cli/env.rs:233-250`:

```rust
fn should_include_key(&self, key: &str, redacted_keys: &IndexSet<String>) -> bool {
    // Check if key matches any redaction pattern (supporting wildcards)
    redacted_keys.iter().any(|pattern| {
        if pattern.contains('*') {
            // Handle wildcard patterns
            if pattern == "*" {
                true
            } else if let Some(prefix) = pattern.strip_suffix('*') {
                key.starts_with(prefix)
            } else if let Some(suffix) = pattern.strip_prefix('*') {
                key.ends_with(suffix)
            } else {
                // Pattern has * in the middle, not supported yet
                false
            }
        } else {
            key == pattern
```

No output path calls `config.redact()` or replaces values with `[redacted]`.

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

Fixture:

```bash
fixture_dir=$(mktemp --directory /tmp/agent/mise-redacted-fixture.XXXXXX)
cat > "$fixture_dir/mise.toml" <<'EOF'
[env]
SECRET_TOKEN = { value = "fixture-secret-token", redact = true }
PUBLIC_VALUE = "visible"
EOF
```

The verification commands used isolated mise dirs and trusted only the fixture:

```bash
MISE_TRUSTED_CONFIG_PATHS="$fixture_dir" \
MISE_CONFIG_DIR="$fixture_dir/config" \
MISE_DATA_DIR="$fixture_dir/data" \
MISE_CACHE_DIR="$fixture_dir/cache" \
mise env --cd "$fixture_dir" --redacted
```

Observed output:

```bash
export SECRET_TOKEN=fixture-secret-token
```

Value-only output also prints the raw sensitive value:

```bash
MISE_TRUSTED_CONFIG_PATHS="$fixture_dir" \
MISE_CONFIG_DIR="$fixture_dir/config" \
MISE_DATA_DIR="$fixture_dir/data" \
MISE_CACHE_DIR="$fixture_dir/cache" \
mise env --cd "$fixture_dir" --redacted --values
```

Observed output:

```text
fixture-secret-token
```

JSON output also prints the raw sensitive value:

```bash
MISE_TRUSTED_CONFIG_PATHS="$fixture_dir" \
MISE_CONFIG_DIR="$fixture_dir/config" \
MISE_DATA_DIR="$fixture_dir/data" \
MISE_CACHE_DIR="$fixture_dir/cache" \
mise env --cd "$fixture_dir" --redacted --json
```

Observed output:

```json
{
  "SECRET_TOKEN": "fixture-secret-token"
}
```

## Verified workarounds

### Do not use `mise env --redacted` as a diagnostic masking command

Treat `mise env --redacted` and `mise env --redacted --values` as secret-output
commands. Run them only when the destination is supposed to receive secrets, for
example a local shell `eval` or a CI masking primitive.

Tradeoff: this avoids accidental disclosure, but it removes the convenient
"show me which variables are redacted" debugging workflow.

### For normal activation, pipe only into the shell that consumes the secrets

Use the command as an activation producer, not as something to inspect:

```bash
eval "$(mise env --shell bash)"
```

Tradeoff: this still materializes secrets in memory and shell state. It avoids
printing them to the terminal by default, but tracing modes such as `set -x`,
agent transcripts, and logging wrappers can still capture expanded commands.

### For CI masking, route values directly to the masking mechanism

The upstream docs intentionally use value output for GitHub Actions masking:

```bash
for value in $(mise env --redacted --values); do
  echo "::add-mask::$value"
done
```

Tradeoff: this loop still emits each value as part of a mask command. It is only
safe when the CI system recognizes the mask primitive before storing or showing
the line. Do not copy this pattern to logs or terminals that do not implement
masking.

### For local key-name diagnostics, parse and discard values locally

When only key names are needed, process JSON locally and print only keys:

```bash
mise env --redacted --json | jq --raw-output 'keys[]'
```

Tradeoff: raw secrets still flow through the pipe into `jq`. This avoids
printing values, but it is not safe if command pipelines are captured by an
untrusted wrapper, shell audit facility, or agent transcript.

## What does not work

- `mise env --redacted` does not mask values. It filters output to keys that are
  configured as redaction-worthy.
- `mise env --redacted --values` is more sensitive, not safer. It prints only
  raw values and omits variable names.
- `mise env --redacted --json` still includes raw values.
- The typo `--redacated` is not a valid flag; the surprising behavior is on the
  correctly spelled `--redacted` flag.
- Relying on terminal scrollback cleanup after the fact is insufficient if the
  command ran in an agent transcript, a CI log, or a shell integration that
  records command output.

## Upstream filing artifact

### Duplicate search

Searched upstream issues and PRs with these queries on 2026-06-06:

```bash
gh search issues 'mise env --redacted prints secret token' --repo jdx/mise --state open --limit 10
gh search issues 'mise env --redacted prints secret token' --repo jdx/mise --state closed --limit 10
gh search prs 'mise env --redacted prints secret token' --repo jdx/mise --state open --limit 10
gh search prs 'mise env --redacted prints secret token' --repo jdx/mise --state closed --limit 10
gh search issues 'redacted values mise env' --repo jdx/mise --state open --limit 10
gh search issues 'redacted values mise env' --repo jdx/mise --state closed --limit 10
gh search prs 'redacted values mise env' --repo jdx/mise --state open --limit 10
gh search prs 'redacted values mise env' --repo jdx/mise --state closed --limit 10
```

No matching issue or PR was found.

### Upstream filing decision

1.  Is it really upstream's fault? Partly. The implementation matches the
    upstream docs, which intentionally expose values for CI masking. The CLI flag
    name and help text are easy to misread as a masking promise.
2.  Can upstream fix it? Yes for wording. Upstream can clarify help text and docs
    without changing the command's data model.
3.  Are they supporting this use case? Yes. The environment docs explicitly show
    `mise env --redacted` and `mise env --redacted --values` for working with
    redaction-marked variables.
4.  Would the repo welcome our contribution? The contribution guide says
    non-obvious changes should start with a discussion or Discord. The issue
    template disables blank issues and points bug reports and questions to
    GitHub Discussions. No AI-assistance ban was found in `CONTRIBUTING.md`, the
    fetched contribution guide, or the issue template during the earlier mise
    token investigation.
5.  Will they likely fix it? Unknown. The current behavior is documented, so a
    wording-only change is plausible but not a correctness fix.
6.  Have we prototyped a minimal fix compatible with their architecture? No. This
    entry does not file upstream because the behavior is documented and the
    immediate risk is local operator misunderstanding. A future upstream filing
    should prototype help text such as "Only show variables marked for
    redaction; values are printed unmasked."

### Nothing to file

Do not file an upstream issue as-is. If this recurs for more users, open a
GitHub Discussion proposing a help-text clarification rather than a bug report.
