# Fastly CLI 16.1.0 `profile list` prints every stored API token unmasked, and its own deprecation notice names a replacement that does not

**Date**:
 2026-10-09.
**Subject**:
 `fastly profile list` writes the stored API token for every profile to
standard output in cleartext,
with no masking and no confirmation,
and in
`--json` mode writes the entire token map including refresh tokens.
The
command is deprecated in favour of `fastly auth list`,
which prints no secret
at all.
Discovered when the token for a live account landed in an agent
transcript during
[`doc/handover/acm-caa-renewal-blocked.md`](../handover/acm-caa-renewal-blocked.md)
work.

## Symptom

```text
$ fastly profile list
DEPRECATED: This command will be removed in a future release. Use 'fastly auth list' instead.

INFO: Default profile highlighted in red.

<profile-name>

Default: true
Email: <account-email>
Token: <34-character API token, in full>
SSO: true
Account ID: <customer-id>
Label: N/A (<account-email>)
```

The token is printed complete.
It is not truncated,
not masked with a prefix,
and not gated behind a confirmation or a `--show-token` flag.
The output goes
to standard output,
so any redirect,
pipe,
`tee`,
terminal recorder,
or agent
tool call that captures stdout captures the credential.

The command's own first line tells the reader to use a different command,
which
makes the leak easy to hit by accident:
a caller looking for "which profiles
exist" reaches for `profile list` because the name describes that,
reads the
deprecation notice only after the secret is already on the terminal,
and has no
reason to expect a listing command to print a credential.

In JSON mode the exposure is wider.
`fastly profile list --json` writes the
whole `Auth.Tokens` map,
which for an SSO profile includes the long-lived
`access_token` and `refresh_token` alongside the legacy API token.

## Root cause

Cloned per this repository's convention:

```bash
gh repo clone fastly/cli "${HOME}/temp/agent/fastly-cli-2026-10-09" -- --depth 1
```

At commit `bb93017`,
`pkg/commands/profile/list.go:79` formats the token
field directly into the output writer:

```go
text.Output(out, "%s: %s", style("Token"), at.Token)
```

`style` is a colouriser passed by the caller,
`text.BoldRed` for the default
profile and `text.Bold` for the others,
so the styling argument decorates the
value rather than redacting it.
Nothing between the config struct and the
writer transforms `at.Token`.

`pkg/commands/profile/list.go:39` is the JSON path,
and it serialises the
entire token collection:

```go
if ok, err := c.WriteJSON(out, c.Globals.Config.Auth.Tokens); ok {
```

`pkg/commands/profile/list.go:32` emits the deprecation notice,
and it fires
only when neither `--quiet` nor `--json` is set:

```go
text.Deprecated("This command will be removed in a future release. Use 'fastly auth list' instead.\n\n")
```

So in `--json` mode the caller gets the wider exposure and no notice.

The named replacement does not print secrets.
`pkg/commands/auth/list.go:73`
is the whole of its per-profile output:

```go
text.Output(out, "%s%s (%s)%s%s\n", marker, name, info, reauthStr, expiryStr)
```

`marker` is `* ` or two spaces,
`name` is the profile name,
`info` is the
token type or the account email,
and the last two are a re-authentication flag
and an expiry summary.
No token field is read.

The likely reason `profile list` prints the token at all is that a human
setting up a second machine wants to copy it.
That is a real use case,
but it
is served by a deliberate command such as `fastly auth token show`,
not by a
listing command whose name promises an inventory.

## Verification

Fastly CLI 16.1.0,
installed through `mise` at
`~/.local/share/mise/installs/npm-fastly-cli/latest/bin/fastly`.
Source read at
commit `bb93017` of `fastly/cli`.
Measured on 2026-10-09 against a live
account with one SSO profile.

Reproduce without printing the secret by measuring lengths instead:

```bash
fastly profile list 2>/dev/null | awk -F': ' '/^Token:/ {print "token chars:", length($2)}'
fastly auth list    2>/dev/null | grep -c -i 'token:' || echo "auth list prints no token field"
```

The first prints a non-zero character count.
The second prints `0` and the
fallback line.

### Catalog: commands that print the credential

- `fastly profile list`
- `fastly profile list --json`,
   which additionally exposes the SSO
  `access_token` and `refresh_token`

### Catalog: commands that do not

- `fastly auth list`,
   the documented replacement
- `fastly whoami`,
   which prints the account display name and email only
- `fastly domain list`,
   `fastly service list`,
   and the other resource
  listings

## Verified workarounds

### 1. Use `fastly auth list`

It answers the question `profile list` appears to answer,
which profiles exist
and which is default,
and adds expiry and re-authentication status that
`profile list` omits.

Tradeoff:
none for inventory purposes.
It does not print the token,
so a
workflow that was copying the token out of `profile list` needs a different
source.

### 2. Read the token from the config file when the value is actually needed

`~/.config/fastly/config.toml` holds it under `[auth.tokens.<profile>]` as
`token`.
Read it in-process and never echo it:

```bash
node --input-type=module -e '
import {readFileSync} from "node:fs";
import {homedir} from "node:os";
const t = readFileSync(homedir() + "/.config/fastly/config.toml", "utf8");
const token = t.match(/^\s*token\s*=\s*"([^"]+)"/m)[1];
console.log("token loaded, length", token.length);'
```

Tradeoff:
it depends on the config file's layout,
which is versioned by the
`config_version` key at the top of the file and can change.
It keeps the secret
out of stdout,
which is the point.

### 3. Rotate after an exposure

A token that reached a transcript,
a log,
or a CI artifact should be treated
as compromised and replaced through the Fastly control panel's API token page.

Tradeoff:
every automation using the old token must be updated in the same
window.

## What does not work

- **Relying on the deprecation notice as a warning.**
   It names a
   replacement;
   it does not say the current command prints a secret,
   and
   it is emitted after the header rather than before the token line.
- **`--quiet` as a redaction mechanism.**
   The guard at
  `pkg/commands/profile/list.go:31` wraps only the `text.Deprecated` call.
   The `display` calls that print the token are unguarded,
   so `--quiet`
   removes the notice and keeps the secret.
- **Assuming the JSON path is safer because it is machine-readable.**
   It
   serialises strictly more secrets,
   including the SSO refresh token,
   and
   skips the deprecation notice.
- **Treating this as an agent-specific hazard.**
   Any shell history logger,
   terminal multiplexer capture,
   or CI step that records stdout has the same
   exposure.

## Upstream filing decision

`.out-of-scope/` was checked and holds no exemption matching Fastly,
a CDN
provider,
or this bug class.
The six-constraint check ends at do not file
publicly.

1.  **Is it really upstream's fault?**
    Partly,
    and the split matters.
    Printing a stored credential from a command whose name and help text
    describe an inventory is a design choice with a foreseeable failure mode,
    not a defect in the sense of incorrect output.
    The aggravating part is
    the asymmetry:
    the deprecated command leaks and its named replacement
    does not,
    so the migration path already contains the correct behaviour.
    Suppressing the deprecation notice under `--json` while widening the
    exposure is the piece that reads as an oversight rather than a choice.
2.  **Can upstream fix it?**
    Yes,
    in `fastly/cli`.
    Removing the token
    line from `display`,
    or gating it behind an explicit flag,
    is a small
    change,
    and `pkg/commands/auth/list.go` already demonstrates the
    secret-free shape.
3.  **Are they supporting this use case?**
    Yes.
    `fastly auth list` is
    maintained,
    documented as the replacement,
    and prints strictly more
    useful status than the command it replaces.
4.  **Would the repo welcome our contribution?**
    For a security-shaped
    report,
    not through the public tracker.
    `SECURITY.md` states that
    "Security issues should be reported privately via Fastly's security issue
    reporting process",
    which is
    <https://www.fastly.com/security/report-security-issue>.
    `CONTRIBUTING.md`
    invites opening an issue to discuss before a pull request,
    and `ISSUES.md`
    lists "A command produces incorrect output or wrong results" as a bug type,
    but neither overrides `SECURITY.md` for a credential-exposure finding.
    No
    ban on external or AI-assisted reports was found in any of the three.
5.  **Will they likely fix it?**
    Plausible but unevidenced.
    The command is
    already deprecated and slated for removal,
    which resolves the exposure on
    its own timeline.
    No tracker search was run,
    because the correct channel
    is private and searching a public tracker for a credential-handling report
    is not how that process works.
6.  **Have we prototyped a minimal fix?**
    No.
    Constraint 1 rates the core
    behaviour a design choice and constraint 4 routes it away from the public
    repository,
    so the auto-prototype trigger does not fire.
    The
    consumer-side fix is complete without one:
    stop calling the command.

Decision:
do not file publicly.
The durable output is this document plus the
operational rule in "Verified workarounds".
If the maintainer wants the
`--json` notice suppression raised,
the channel is Fastly's private security
process,
and the content worth sending is
`pkg/commands/profile/list.go:32`
together with
`pkg/commands/profile/list.go:39`.

The token exposed during the investigation that produced this document was a
legacy API token for a live account.
It reached an agent transcript rather than
a public artifact.
Rotation was recommended to the maintainer and is their
decision,
since it requires updating every automation that uses it.

## References

- `fastly/cli` source,
  read at commit `bb93017`:
  <https://github.com/fastly/cli>
- Fastly security issue reporting process,
  which `SECURITY.md` names as the
  channel for security reports:
  <https://www.fastly.com/security/report-security-issue>
- Fastly CLI reference index:
  <https://www.fastly.com/documentation/reference/cli/>
- Related:
  [`fastly-api-reads-report-live-resources-absent.md`](fastly-api-reads-report-live-resources-absent.md),
  the API-side findings from the same investigation,
  and
  [`doc/handover/acm-caa-renewal-blocked.md`](../handover/acm-caa-renewal-blocked.md),
  the task this surfaced during.
